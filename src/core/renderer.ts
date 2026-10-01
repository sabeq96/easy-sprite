import { compositeFrame, presentSprite } from "@/core/composite";
import type { SpriteDocument } from "@/core/document";
import type { Viewport } from "@/core/viewport";

/** The channels painters draw on; `main` (the current frame's composite) is built in. */
export type PaintChannel = "onion" | "overlay";
type Channel = "main" | PaintChannel;

export type RendererTargets = Record<Channel, HTMLCanvasElement>;

/** What a painter is handed: its channel's context, already prepared, and the state to draw. */
export interface PaintContext {
  /** Cleared, in CSS pixels, smoothing off. */
  ctx: CanvasRenderingContext2D;
  viewport: Viewport;
  doc: SpriteDocument;
  frameId: string;
  isPlaying: boolean;
  dpr: number;
}

export interface Painter {
  channel: PaintChannel;
  paint(p: PaintContext): void;
}

export interface RendererState {
  viewport: Viewport;
  frameId: string;
  /** Painters may skip work during playback; a change repaints the channels below `main`. */
  isPlaying: boolean;
}

export class CanvasRenderer {
  private readonly doc: SpriteDocument;
  private readonly targets: RendererTargets;
  private readonly dirty = new Set<Channel>(["main", "onion", "overlay"]);
  private readonly composite = new OffscreenCanvas(1, 1);
  private readonly offPixels: () => void;
  /** In registration order, which is the drawing order within a channel. */
  private readonly painters: Painter[] = [];

  private state: RendererState;
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
    if (patch.isPlaying !== undefined && patch.isPlaying !== previous.isPlaying) {
      this.invalidate("onion");
    }
  }

  /** Drawn on its channel after every painter added before it. Returns the remover. */
  addPainter(painter: Painter): () => void {
    this.painters.push(painter);
    this.invalidate(painter.channel);
    return () => {
      const index = this.painters.indexOf(painter);
      if (index === -1) return;
      this.painters.splice(index, 1);
      this.invalidate(painter.channel);
    };
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
    for (const canvas of Object.values(this.targets)) {
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
    if (this.dirty.has("onion")) this.renderPainters("onion");
    if (this.dirty.has("main")) this.renderMain();
    if (this.dirty.has("overlay")) this.renderPainters("overlay");
    this.dirty.clear();
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
    const source = compositeFrame(this.doc, this.state.frameId, this.composite);
    presentSprite(ctx, source, this.state.viewport, this.doc, 1);
  }

  private renderPainters(channel: PaintChannel): void {
    const ctx = this.context(this.targets[channel]);
    if (!ctx) return;
    const { viewport, frameId, isPlaying } = this.state;
    const p: PaintContext = { ctx, viewport, doc: this.doc, frameId, isPlaying, dpr: this.dpr };
    for (const painter of this.painters) {
      if (painter.channel === channel) painter.paint(p);
    }
  }
}
