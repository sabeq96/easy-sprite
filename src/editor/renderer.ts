import { onionOffset, type OnionDirection } from "@/constants/animation";
import { GRID_MIN_SCALE } from "@/constants/canvas";
import { compositeFrame } from "@/editor/composite";
import type { SpriteDocument } from "@/editor/document";
import type { Viewport } from "@/editor/viewport";

export interface OnionSettings {
  enabled: boolean;
  direction: OnionDirection;
  opacity: number;
}

export interface RendererTargets {
  main: HTMLCanvasElement;
  onion: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
}

export interface RendererState {
  viewport: Viewport;
  frameId: string;
  gridEnabled: boolean;
  onion: OnionSettings;
  /** Onion skin is meaningless during playback and costs a composite per ghost frame. */
  isPlaying: boolean;
}

/** Tools install a painter to draw cursors, previews and selection ants. */
export type OverlayPainter = (ctx: CanvasRenderingContext2D, viewport: Viewport) => void;

type Channel = "main" | "onion" | "overlay";

export class CanvasRenderer {
  private readonly doc: SpriteDocument;
  private readonly targets: RendererTargets;
  private readonly dirty = new Set<Channel>(["main", "onion", "overlay"]);
  private readonly composite = new OffscreenCanvas(1, 1);
  private readonly onionScratch = new OffscreenCanvas(1, 1);
  private readonly offPixels: () => void;

  private state: RendererState;
  /** The active tool's own preview — brush cursor, drag marquee, floating-move ghost. */
  private overlayPainter: OverlayPainter | null = null;
  private overlayAnimating = false;
  /**
   * The committed selection's marching ants, drawn underneath the tool preview. Kept on its
   * own channel and driven straight from store state (see `useSelectionOverlay`) rather than
   * from tool pointer handlers, so it stays correct no matter how the selection changed —
   * a drag, Ctrl+A, paste, or Escape all look the same from here.
   */
  private selectionPainter: OverlayPainter | null = null;
  private selectionAnimating = false;
  private rafId = 0;
  private dpr = 1;
  private disposed = false;

  constructor(doc: SpriteDocument, targets: RendererTargets, initialState: RendererState) {
    this.doc = doc;
    this.targets = targets;
    this.state = initialState;
    this.offPixels = doc.events.on("pixels", () => this.invalidate("main", "onion"));
  }

  setState(patch: Partial<RendererState>): void {
    const previous = this.state;
    this.state = { ...previous, ...patch };

    if (patch.viewport && patch.viewport !== previous.viewport) {
      this.invalidate("main", "onion", "overlay");
    }
    if (patch.frameId && patch.frameId !== previous.frameId) this.invalidate("main", "onion");
    if (patch.gridEnabled !== undefined && patch.gridEnabled !== previous.gridEnabled) {
      this.invalidate("overlay");
    }
    if (patch.onion && patch.onion !== previous.onion) this.invalidate("onion");
    if (patch.isPlaying !== undefined && patch.isPlaying !== previous.isPlaying) {
      this.invalidate("onion");
    }
  }

  setOverlayPainter(painter: OverlayPainter | null, animate = false): void {
    this.overlayPainter = painter;
    this.overlayAnimating = painter !== null && animate;
    this.invalidate("overlay");
  }

  setSelectionOverlay(painter: OverlayPainter | null, animate = false): void {
    this.selectionPainter = painter;
    this.selectionAnimating = painter !== null && animate;
    this.invalidate("overlay");
  }

  /** Redraws everything — call after a structural change (layer order, visibility). */
  invalidateAll(): void {
    this.invalidate("main", "onion", "overlay");
  }

  invalidate(...channels: Channel[]): void {
    for (const channel of channels) this.dirty.add(channel);
    this.schedule();
  }

  /** Called from a ResizeObserver. Sizes the backing store to device pixels. */
  resize(cssWidth: number, cssHeight: number, dpr = window.devicePixelRatio || 1): void {
    this.dpr = dpr;
    for (const canvas of [this.targets.main, this.targets.onion, this.targets.overlay]) {
      canvas.width = Math.max(1, Math.round(cssWidth * dpr));
      canvas.height = Math.max(1, Math.round(cssHeight * dpr));
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }
    this.invalidateAll();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.offPixels();
  }

  private schedule(): void {
    if (this.rafId || this.disposed) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.render();
    });
  }

  private render(): void {
    if (this.dirty.has("onion")) this.renderOnion();
    if (this.dirty.has("main")) this.renderMain();
    if (this.dirty.has("overlay")) this.renderOverlay();
    this.dirty.clear();

    // Marching ants and brush previews need a continuous repaint while active.
    if (this.overlayAnimating || this.selectionAnimating) this.invalidate("overlay");
  }

  private context(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); // work in CSS pixels
    ctx.clearRect(0, 0, canvas.width / this.dpr, canvas.height / this.dpr);
    ctx.imageSmoothingEnabled = false; // nearest-neighbour upscaling
    return ctx;
  }

  private renderMain(): void {
    const ctx = this.context(this.targets.main);
    if (!ctx) return;
    this.present(ctx, compositeFrame(this.doc, this.state.frameId, this.composite), 1);
  }

  private renderOnion(): void {
    const ctx = this.context(this.targets.onion);
    if (!ctx) return;

    const { enabled, direction, opacity } = this.state.onion;
    if (!enabled || this.state.isPlaying) return;

    // Clamped, never wrapped: a ghost past the ends would read as a bug.
    const index = this.doc.frameIndex(this.state.frameId);
    const frame = this.doc.frames[index + onionOffset(direction)];
    if (!frame) return;

    const source = compositeFrame(this.doc, frame.id, this.onionScratch);
    this.present(ctx, source, opacity);
  }

  private renderOverlay(): void {
    const ctx = this.context(this.targets.overlay);
    if (!ctx) return;
    if (this.state.gridEnabled) this.drawGrid(ctx);
    this.selectionPainter?.(ctx, this.state.viewport);
    this.overlayPainter?.(ctx, this.state.viewport);
  }

  private present(ctx: CanvasRenderingContext2D, source: OffscreenCanvas, alpha: number): void {
    const { scale, originX, originY } = this.state.viewport;
    ctx.globalAlpha = alpha;
    ctx.drawImage(source, originX, originY, this.doc.width * scale, this.doc.height * scale);
    ctx.globalAlpha = 1;
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const { scale, originX, originY } = this.state.viewport;
    if (scale < GRID_MIN_SCALE) return; // a sub-pixel grid is just noise

    const width = this.doc.width * scale;
    const height = this.doc.height * scale;
    // Half-pixel offset puts a 1px line on the boundary instead of straddling it.
    const offset = 0.5 / this.dpr;

    ctx.lineWidth = 1 / this.dpr;
    ctx.strokeStyle = "rgba(128,128,128,0.35)";
    ctx.beginPath();

    for (let x = 0; x <= this.doc.width; x++) {
      const screenX = Math.round(originX + x * scale) + offset;
      ctx.moveTo(screenX, originY);
      ctx.lineTo(screenX, originY + height);
    }
    for (let y = 0; y <= this.doc.height; y++) {
      const screenY = Math.round(originY + y * scale) + offset;
      ctx.moveTo(originX, screenY);
      ctx.lineTo(originX + width, screenY);
    }

    ctx.stroke();
  }
}
