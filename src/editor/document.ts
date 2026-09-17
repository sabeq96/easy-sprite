import { createBuffer, isBufferEmpty, resizeBuffer, type ResizeOptions } from "@/editor/buffer";
import { type Cel, celKey, createCel } from "@/editor/cel";
import { Emitter } from "@/editor/emitter";
import { createId } from "@/lib/id";
import type { Rect } from "@/lib/rect";
import type { PixelBuffer } from "@/types/pixels";

export interface LayerModel {
  id: string;
  name: string;
  /** 0–1 */
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export interface FrameModel {
  id: string;
}

export interface CelData {
  layerId: string;
  frameId: string;
  pixels: PixelBuffer;
}

export interface DocumentInit {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  /** Bottom → top. */
  layers: LayerModel[];
  frames: FrameModel[];
  cels: CelData[];
}

export interface PixelsChanged {
  layerId: string;
  frameId: string;
  rect: Rect;
}

export interface DocumentEvents {
  /** A cel's pixels changed. The renderer listens; React must not. */
  pixels: PixelsChanged;
  /** Layers or frames were added, removed or reordered. */
  structure: void;
  /** Name, size, fps, or a layer property changed. */
  meta: void;
}

export type RevisionChannel = "structure" | "meta";

/**
 * Layers and frames are replaced, never mutated in place.
 *
 * Pixel buffers stay mutable because that is the hot path, but these arrays are tiny and their
 * identity is load-bearing: React (and the React Compiler in particular) treats an unchanged
 * array reference as an unchanged value and will happily reuse stale JSX forever.
 */
export class SpriteDocument {
  readonly id: string;
  readonly events = new Emitter<DocumentEvents>();
  /** Monotonic counters for useSyncExternalStore — see hooks/useDocumentRevision. */
  readonly revisions: Record<RevisionChannel, number> = { structure: 0, meta: 0 };

  name: string;
  width: number;
  height: number;
  fps: number;
  layers: LayerModel[];
  frames: FrameModel[];

  private cels = new Map<string, Cel>();

  constructor(init: DocumentInit) {
    this.id = init.id;
    this.name = init.name;
    this.width = init.width;
    this.height = init.height;
    this.fps = init.fps;
    this.layers = [...init.layers];
    this.frames = [...init.frames];

    for (const cel of init.cels) {
      this.cels.set(
        celKey(cel.layerId, cel.frameId),
        createCel(cel.layerId, cel.frameId, init.width, init.height, cel.pixels),
      );
    }
  }

  // ── cels ──────────────────────────────────────────────────────────────────

  /** Null for an unpainted cel — cheap enough to call in a render loop. */
  getCel(layerId: string, frameId: string): Cel | null {
    return this.cels.get(celKey(layerId, frameId)) ?? null;
  }

  /** Creates the cel on demand. Tools call this; renderers do not. */
  ensureCel(layerId: string, frameId: string): Cel {
    const key = celKey(layerId, frameId);
    let cel = this.cels.get(key);
    if (!cel) {
      cel = createCel(layerId, frameId, this.width, this.height);
      this.cels.set(key, cel);
    }
    return cel;
  }

  /** Call after writing into `cel.pixels`. `rect` bounds what changed. */
  markPixelsChanged(cel: Cel, rect: Rect): void {
    cel.rasterDirty = true;
    cel.storeDirty = true;
    this.events.emit("pixels", { layerId: cel.layerId, frameId: cel.frameId, rect });
  }

  /** Autosave handoff: returns dirty cels and clears their flag. */
  takeDirtyCels(): CelData[] {
    const dirty: CelData[] = [];
    for (const cel of this.cels.values()) {
      if (!cel.storeDirty) continue;
      cel.storeDirty = false;
      dirty.push({ layerId: cel.layerId, frameId: cel.frameId, pixels: cel.pixels });
    }
    return dirty;
  }

  snapshotCel(layerId: string, frameId: string): PixelBuffer {
    const cel = this.getCel(layerId, frameId);
    return cel ? new Uint8ClampedArray(cel.pixels) : createBuffer(this.width, this.height);
  }

  // ── layers ────────────────────────────────────────────────────────────────

  layerIndex(layerId: string): number {
    return this.layers.findIndex((layer) => layer.id === layerId);
  }

  getLayer(layerId: string): LayerModel | null {
    return this.layers.find((layer) => layer.id === layerId) ?? null;
  }

  addLayer(name?: string, atIndex = this.layers.length): LayerModel {
    const layer: LayerModel = {
      id: createId(),
      name: name ?? `Layer ${this.layers.length + 1}`,
      opacity: 1,
      visible: true,
      locked: false,
    };
    this.layers = insertAt(this.layers, atIndex, layer);
    this.bump("structure");
    return layer;
  }

  insertLayer(layer: LayerModel, atIndex: number, cels: CelData[] = []): void {
    this.layers = insertAt(this.layers, atIndex, layer);
    for (const cel of cels) {
      const restored = createCel(cel.layerId, cel.frameId, this.width, this.height, cel.pixels);
      restored.storeDirty = true;
      this.cels.set(celKey(cel.layerId, cel.frameId), restored);
    }
    this.bump("structure");
  }

  /** Returns the removed layer and its cels so a command can put them back. */
  removeLayer(layerId: string): { layer: LayerModel; index: number; cels: CelData[] } | null {
    const index = this.layerIndex(layerId);
    // A document always keeps at least one layer.
    if (index === -1 || this.layers.length === 1) return null;

    const layer = this.layers[index];
    this.layers = this.layers.filter((candidate) => candidate.id !== layerId);

    const removed: CelData[] = [];
    for (const frame of this.frames) {
      const key = celKey(layerId, frame.id);
      const cel = this.cels.get(key);
      if (!cel) continue;
      removed.push({ layerId, frameId: frame.id, pixels: cel.pixels });
      this.cels.delete(key);
    }

    this.bump("structure");
    return { layer, index, cels: removed };
  }

  moveLayer(from: number, to: number): void {
    if (from === to || from < 0 || from >= this.layers.length) return;
    this.layers = moveItem(this.layers, from, to);
    this.bump("structure");
  }

  setLayerProps(layerId: string, patch: Partial<Omit<LayerModel, "id">>): void {
    if (!this.getLayer(layerId)) return;
    this.layers = this.layers.map((layer) =>
      layer.id === layerId ? { ...layer, ...patch } : layer,
    );
    this.bump("meta");
  }

  // ── frames ────────────────────────────────────────────────────────────────

  frameIndex(frameId: string): number {
    return this.frames.findIndex((frame) => frame.id === frameId);
  }

  addFrame(atIndex = this.frames.length, copyOfFrameId?: string): FrameModel {
    const frame: FrameModel = { id: createId() };
    this.frames = insertAt(this.frames, atIndex, frame);

    if (copyOfFrameId) {
      for (const layer of this.layers) {
        const source = this.getCel(layer.id, copyOfFrameId);
        if (!source || isBufferEmpty(source.pixels)) continue;

        const copy = createCel(
          layer.id,
          frame.id,
          this.width,
          this.height,
          new Uint8ClampedArray(source.pixels),
        );
        copy.storeDirty = true;
        this.cels.set(celKey(layer.id, frame.id), copy);
      }
    }

    this.bump("structure");
    return frame;
  }

  removeFrame(frameId: string): { frame: FrameModel; index: number; cels: CelData[] } | null {
    const index = this.frameIndex(frameId);
    // A document always keeps at least one frame.
    if (index === -1 || this.frames.length === 1) return null;

    const frame = this.frames[index];
    this.frames = this.frames.filter((candidate) => candidate.id !== frameId);

    const removed: CelData[] = [];
    for (const layer of this.layers) {
      const key = celKey(layer.id, frameId);
      const cel = this.cels.get(key);
      if (!cel) continue;
      removed.push({ layerId: layer.id, frameId, pixels: cel.pixels });
      this.cels.delete(key);
    }

    this.bump("structure");
    return { frame, index, cels: removed };
  }

  insertFrame(frame: FrameModel, atIndex: number, cels: CelData[] = []): void {
    this.frames = insertAt(this.frames, atIndex, frame);
    for (const cel of cels) {
      const restored = createCel(cel.layerId, cel.frameId, this.width, this.height, cel.pixels);
      restored.storeDirty = true;
      this.cels.set(celKey(cel.layerId, cel.frameId), restored);
    }
    this.bump("structure");
  }

  moveFrame(from: number, to: number): void {
    if (from === to || from < 0 || from >= this.frames.length) return;
    this.frames = moveItem(this.frames, from, to);
    this.bump("structure");
  }

  // ── canvas ────────────────────────────────────────────────────────────────

  /** Destructive: callers snapshot for undo first (see resizeCanvasCommand). */
  resize(width: number, height: number, options: ResizeOptions = {}): void {
    const from = { width: this.width, height: this.height };
    const resized = new Map<string, Cel>();

    for (const [key, cel] of this.cels) {
      const pixels = resizeBuffer(cel.pixels, from, { width, height }, options);
      const next = createCel(cel.layerId, cel.frameId, width, height, pixels);
      next.storeDirty = true;
      resized.set(key, next);
    }

    this.cels = resized;
    this.width = width;
    this.height = height;
    this.bump("meta");
    this.bump("structure");
  }

  setMeta(patch: { name?: string; fps?: number }): void {
    if (patch.name !== undefined) this.name = patch.name;
    if (patch.fps !== undefined) this.fps = patch.fps;
    this.bump("meta");
  }

  /** Bytes of pixel data held in memory — shown in the status bar and quota warnings. */
  get byteSize(): number {
    return this.cels.size * this.width * this.height * 4;
  }

  get celCount(): number {
    return this.cels.size;
  }

  private bump(channel: RevisionChannel): void {
    this.revisions[channel]++;
    this.events.emit(channel, undefined);
  }
}

function insertAt<T>(items: readonly T[], index: number, item: T): T[] {
  const clamped = Math.max(0, Math.min(index, items.length));
  return [...items.slice(0, clamped), item, ...items.slice(clamped)];
}

function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}
