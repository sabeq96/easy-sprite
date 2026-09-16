# Phase 2 — Document runtime, history & autosave

**Goal:** the in-memory model that the whole editor mutates — `SpriteDocument` — plus undo/redo
and debounced persistence. Still no canvas and no UI: this phase is verified by unit tests and a
console session.

**Est.** 1.5 days · **Depends on:** phase 1

---

## 2.1 Typed event emitter

`src/editor/emitter.ts`

```ts
export type Listener<T> = (payload: T) => void;
export type Unsubscribe = () => void;

export class Emitter<Events extends Record<string, unknown>> {
  // One cast, kept local: the map is heterogeneous by key but each Set is homogeneous.
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => { set.delete(listener as Listener<never>); };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) (listener as Listener<Events[K]>)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
```

## 2.2 Buffer primitives

Pure functions over `Uint8ClampedArray`, no canvas, no document. Drawing algorithms come in
phase 4; this is the substrate both it and history need.

`src/editor/buffer.ts`

```ts
import type { Rect } from '@/lib/rect';
import type { RGBA } from '@/lib/color';

export const BYTES_PER_PIXEL = 4;

export function createBuffer(width: number, height: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height * BYTES_PER_PIXEL);
}

export function bufferIndex(x: number, y: number, width: number): number {
  return (y * width + x) * BYTES_PER_PIXEL;
}

export function getPixel(buffer: Uint8ClampedArray, x: number, y: number, width: number): RGBA {
  const i = bufferIndex(x, y, width);
  return { r: buffer[i], g: buffer[i + 1], b: buffer[i + 2], a: buffer[i + 3] };
}

/** Replaces the pixel outright — no blending. Callers handle blending explicitly. */
export function setPixel(buffer: Uint8ClampedArray, x: number, y: number, width: number, color: RGBA): void {
  const i = bufferIndex(x, y, width);
  buffer[i] = color.r; buffer[i + 1] = color.g; buffer[i + 2] = color.b; buffer[i + 3] = color.a;
}

/** Straight-alpha source-over. Used when the active colour is semi-transparent. */
export function blendPixel(buffer: Uint8ClampedArray, x: number, y: number, width: number, src: RGBA): void {
  if (src.a === 255) return setPixel(buffer, x, y, width, src);
  if (src.a === 0) return;

  const i = bufferIndex(x, y, width);
  const sa = src.a / 255;
  const da = buffer[i + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA === 0) { buffer[i + 3] = 0; return; }

  buffer[i]     = (src.r * sa + buffer[i]     * da * (1 - sa)) / outA;
  buffer[i + 1] = (src.g * sa + buffer[i + 1] * da * (1 - sa)) / outA;
  buffer[i + 2] = (src.b * sa + buffer[i + 2] * da * (1 - sa)) / outA;
  buffer[i + 3] = outA * 255;
}

export function cropRegion(buffer: Uint8ClampedArray, width: number, rect: Rect): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rect.w * rect.h * BYTES_PER_PIXEL);
  const rowBytes = rect.w * BYTES_PER_PIXEL;
  for (let row = 0; row < rect.h; row++) {
    const from = bufferIndex(rect.x, rect.y + row, width);
    out.set(buffer.subarray(from, from + rowBytes), row * rowBytes);
  }
  return out;
}

export function pasteRegion(
  buffer: Uint8ClampedArray, width: number, rect: Rect, region: Uint8ClampedArray,
): void {
  const rowBytes = rect.w * BYTES_PER_PIXEL;
  for (let row = 0; row < rect.h; row++) {
    buffer.set(region.subarray(row * rowBytes, (row + 1) * rowBytes), bufferIndex(rect.x, rect.y + row, width));
  }
}

export function clearRegion(buffer: Uint8ClampedArray, width: number, rect: Rect): void {
  const rowBytes = rect.w * BYTES_PER_PIXEL;
  for (let row = 0; row < rect.h; row++) {
    buffer.fill(0, bufferIndex(rect.x, rect.y + row, width), bufferIndex(rect.x, rect.y + row, width) + rowBytes);
  }
}

export function isBufferEmpty(buffer: Uint8ClampedArray): boolean {
  for (let i = 3; i < buffer.length; i += BYTES_PER_PIXEL) if (buffer[i] !== 0) return false;
  return true;
}

export interface ResizeOptions { anchorX?: 'left' | 'center' | 'right'; anchorY?: 'top' | 'center' | 'bottom' }

/** Nearest-neighbour-free resize: pixels keep their values, the canvas is cropped/padded. */
export function resizeBuffer(
  buffer: Uint8ClampedArray, from: { width: number; height: number },
  to: { width: number; height: number }, options: ResizeOptions = {},
): Uint8ClampedArray {
  const out = createBuffer(to.width, to.height);
  const offsetX = align(to.width - from.width, options.anchorX ?? 'left');
  const offsetY = align(to.height - from.height, options.anchorY ?? 'top');

  for (let y = 0; y < from.height; y++) {
    const targetY = y + offsetY;
    if (targetY < 0 || targetY >= to.height) continue;
    for (let x = 0; x < from.width; x++) {
      const targetX = x + offsetX;
      if (targetX < 0 || targetX >= to.width) continue;
      const src = bufferIndex(x, y, from.width);
      out.set(buffer.subarray(src, src + BYTES_PER_PIXEL), bufferIndex(targetX, targetY, to.width));
    }
  }
  return out;
}

function align(delta: number, anchor: string): number {
  if (anchor === 'center') return Math.floor(delta / 2);
  return anchor === 'right' || anchor === 'bottom' ? delta : 0;
}
```

## 2.3 Cel

`src/editor/cel.ts`

```ts
import { createBuffer } from '@/editor/buffer';

export interface Cel {
  readonly layerId: string;
  readonly frameId: string;
  readonly width: number;
  readonly height: number;
  /** The single source of truth for this cel's pixels. Tools write here. */
  readonly pixels: Uint8ClampedArray;
  /** Wraps `pixels` — same memory, no copy. Only used to blit into `canvas`. */
  readonly imageData: ImageData;
  /** Raster cache used by the compositor; refreshed lazily via syncCelRaster(). */
  readonly canvas: OffscreenCanvas;
  rasterDirty: boolean;
  storeDirty: boolean;
}

export function celKey(layerId: string, frameId: string): string {
  return `${layerId}:${frameId}`;
}

export function createCel(
  layerId: string, frameId: string, width: number, height: number, pixels?: Uint8ClampedArray,
): Cel {
  const buffer = pixels ?? createBuffer(width, height);
  return {
    layerId,
    frameId,
    width,
    height,
    pixels: buffer,
    // ImageData shares the buffer, so writes to `pixels` need no copy before putImageData.
    imageData: new ImageData(buffer, width, height),
    canvas: new OffscreenCanvas(width, height),
    rasterDirty: true,
    storeDirty: false,
  };
}

export function syncCelRaster(cel: Cel): void {
  if (!cel.rasterDirty) return;
  const ctx = cel.canvas.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(cel.imageData, 0, 0);
  cel.rasterDirty = false;
}
```

> `putImageData` ignores `globalAlpha` and composite modes and writes straight-alpha values
> verbatim, which is exactly what we want: the cel canvas is a faithful raster of the buffer, and
> all blending happens later in the compositor.

## 2.4 SpriteDocument

The mutable heart of the editor. Every mutation bumps a revision counter and emits an event;
React subscribes to the counters (§2.7), the renderer subscribes to `pixels`.

`src/editor/document.ts`

```ts
import { Emitter } from '@/editor/emitter';
import { type Cel, celKey, createCel } from '@/editor/cel';
import { createBuffer, isBufferEmpty, resizeBuffer, type ResizeOptions } from '@/editor/buffer';
import type { Rect } from '@/lib/rect';
import { createId } from '@/lib/id';

export interface LayerModel {
  id: string; name: string; opacity: number; visible: boolean; locked: boolean;
}
export interface FrameModel { id: string }

export interface DocumentInit {
  id: string; name: string; width: number; height: number; fps: number;
  layers: LayerModel[];                      // bottom → top
  frames: FrameModel[];
  cels: { layerId: string; frameId: string; pixels: Uint8ClampedArray }[];
}

export interface PixelsChanged { layerId: string; frameId: string; rect: Rect }

export interface DocumentEvents {
  /** A cel's pixels changed. Renderer listens; React must not. */
  pixels: PixelsChanged;
  /** Layers or frames were added, removed or reordered. */
  structure: void;
  /** Name, size, fps, or layer properties changed. */
  meta: void;
}

export type DirtyCel = { layerId: string; frameId: string; pixels: Uint8ClampedArray };

export class SpriteDocument {
  readonly id: string;
  readonly events = new Emitter<DocumentEvents>();
  /** Monotonic counters for useSyncExternalStore — see hooks/useDocumentRevision. */
  readonly revisions = { structure: 0, meta: 0 };

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
      this.cels.set(celKey(cel.layerId, cel.frameId),
        createCel(cel.layerId, cel.frameId, init.width, init.height, cel.pixels));
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

  /** Call after writing into `cel.pixels`. `rect` bounds what changed, for dirty-rect redraws. */
  markPixelsChanged(cel: Cel, rect: Rect): void {
    cel.rasterDirty = true;
    cel.storeDirty = true;
    this.events.emit('pixels', { layerId: cel.layerId, frameId: cel.frameId, rect });
  }

  /** Autosave handoff: returns dirty cels and clears their flag. */
  takeDirtyCels(): DirtyCel[] {
    const dirty: DirtyCel[] = [];
    for (const cel of this.cels.values()) {
      if (!cel.storeDirty) continue;
      cel.storeDirty = false;
      dirty.push({ layerId: cel.layerId, frameId: cel.frameId, pixels: cel.pixels });
    }
    return dirty;
  }

  // ── layers ────────────────────────────────────────────────────────────────
  layerIndex(layerId: string): number {
    return this.layers.findIndex((layer) => layer.id === layerId);
  }

  addLayer(name?: string, atIndex = this.layers.length): LayerModel {
    const layer: LayerModel = {
      id: createId(),
      name: name ?? `Layer ${this.layers.length + 1}`,
      opacity: 1, visible: true, locked: false,
    };
    this.layers.splice(atIndex, 0, layer);
    this.bump('structure');
    return layer;
  }

  insertLayer(layer: LayerModel, atIndex: number, cels: DirtyCel[] = []): void {
    this.layers.splice(atIndex, 0, layer);
    for (const cel of cels) {
      this.cels.set(celKey(cel.layerId, cel.frameId),
        createCel(cel.layerId, cel.frameId, this.width, this.height, cel.pixels));
    }
    this.bump('structure');
  }

  /** Returns the removed layer and its cels so a command can put them back. */
  removeLayer(layerId: string): { layer: LayerModel; index: number; cels: DirtyCel[] } | null {
    const index = this.layerIndex(layerId);
    if (index === -1 || this.layers.length === 1) return null; // never leave zero layers

    const [layer] = this.layers.splice(index, 1);
    const removed: DirtyCel[] = [];
    for (const frame of this.frames) {
      const key = celKey(layerId, frame.id);
      const cel = this.cels.get(key);
      if (cel) {
        removed.push({ layerId, frameId: frame.id, pixels: cel.pixels });
        this.cels.delete(key);
      }
    }
    this.bump('structure');
    return { layer, index, cels: removed };
  }

  moveLayer(from: number, to: number): void {
    const [layer] = this.layers.splice(from, 1);
    this.layers.splice(to, 0, layer);
    this.bump('structure');
  }

  setLayerProps(layerId: string, patch: Partial<Omit<LayerModel, 'id'>>): void {
    const layer = this.layers.find((candidate) => candidate.id === layerId);
    if (!layer) return;
    Object.assign(layer, patch);
    this.bump('meta');
  }

  // ── frames ────────────────────────────────────────────────────────────────
  frameIndex(frameId: string): number {
    return this.frames.findIndex((frame) => frame.id === frameId);
  }

  addFrame(atIndex = this.frames.length, copyOfFrameId?: string): FrameModel {
    const frame: FrameModel = { id: createId() };
    this.frames.splice(atIndex, 0, frame);

    if (copyOfFrameId) {
      for (const layer of this.layers) {
        const source = this.getCel(layer.id, copyOfFrameId);
        if (!source || isBufferEmpty(source.pixels)) continue;
        const copy = createCel(layer.id, frame.id, this.width, this.height,
          new Uint8ClampedArray(source.pixels));
        copy.storeDirty = true;
        this.cels.set(celKey(layer.id, frame.id), copy);
      }
    }
    this.bump('structure');
    return frame;
  }

  removeFrame(frameId: string): { frame: FrameModel; index: number; cels: DirtyCel[] } | null {
    const index = this.frameIndex(frameId);
    if (index === -1 || this.frames.length === 1) return null;

    const [frame] = this.frames.splice(index, 1);
    const removed: DirtyCel[] = [];
    for (const layer of this.layers) {
      const key = celKey(layer.id, frameId);
      const cel = this.cels.get(key);
      if (cel) {
        removed.push({ layerId: layer.id, frameId, pixels: cel.pixels });
        this.cels.delete(key);
      }
    }
    this.bump('structure');
    return { frame, index, cels: removed };
  }

  insertFrame(frame: FrameModel, atIndex: number, cels: DirtyCel[] = []): void {
    this.frames.splice(atIndex, 0, frame);
    for (const cel of cels) {
      this.cels.set(celKey(cel.layerId, cel.frameId),
        createCel(cel.layerId, cel.frameId, this.width, this.height, cel.pixels));
    }
    this.bump('structure');
  }

  moveFrame(from: number, to: number): void {
    const [frame] = this.frames.splice(from, 1);
    this.frames.splice(to, 0, frame);
    this.bump('structure');
  }

  // ── canvas ────────────────────────────────────────────────────────────────
  /** Destructive: callers must snapshot for undo first (see ResizeCanvasCommand). */
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
    this.bump('meta');
    this.bump('structure');
  }

  setMeta(patch: Partial<Pick<SpriteDocument, 'name' | 'fps'>>): void {
    Object.assign(this, patch);
    this.bump('meta');
  }

  /** Bytes of pixel data held in memory — surfaced in the status bar and quota warnings. */
  get byteSize(): number {
    return this.cels.size * this.width * this.height * 4;
  }

  snapshotCel(layerId: string, frameId: string): Uint8ClampedArray {
    const cel = this.getCel(layerId, frameId);
    return cel ? new Uint8ClampedArray(cel.pixels) : createBuffer(this.width, this.height);
  }

  private bump(channel: 'structure' | 'meta'): void {
    this.revisions[channel]++;
    this.events.emit(channel, undefined);
  }
}
```

Two invariants worth stating out loud because later phases depend on them:

1. **A document always has ≥ 1 layer and ≥ 1 frame.** `removeLayer`/`removeFrame` return `null`
   instead of emptying the document, so the UI can disable the button without special cases.
2. **Structural removals return their cels.** That is what makes undo of "delete layer" exact
   rather than approximate.

## 2.5 History

`src/editor/history.ts`

```ts
import { Emitter } from '@/editor/emitter';
import { cropRegion, pasteRegion } from '@/editor/buffer';
import { rectUnion, type Rect } from '@/lib/rect';
import { HISTORY_MAX_BYTES, HISTORY_MAX_ENTRIES } from '@/constants/storage';
import type { SpriteDocument } from '@/editor/document';

export interface Command {
  readonly label: string;
  readonly sizeBytes: number;
  undo(): void;
  redo(): void;
}

export interface HistoryEvents { change: void }

export class History {
  readonly events = new Emitter<HistoryEvents>();
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private bytes = 0;

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  get undoLabel(): string | null { return this.undoStack.at(-1)?.label ?? null; }
  get redoLabel(): string | null { return this.redoStack.at(-1)?.label ?? null; }

  /** Pushes an already-applied command. Commands are never executed on push. */
  push(command: Command): void {
    this.undoStack.push(command);
    this.bytes += command.sizeBytes;
    this.redoStack.length = 0;
    this.trim();
    this.events.emit('change', undefined);
  }

  undo(): void {
    const command = this.undoStack.pop();
    if (!command) return;
    command.undo();
    this.redoStack.push(command);
    this.events.emit('change', undefined);
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (!command) return;
    command.redo();
    this.undoStack.push(command);
    this.events.emit('change', undefined);
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.bytes = 0;
    this.events.emit('change', undefined);
  }

  private trim(): void {
    while (this.undoStack.length > HISTORY_MAX_ENTRIES || this.bytes > HISTORY_MAX_BYTES) {
      const dropped = this.undoStack.shift();
      if (!dropped) break;
      this.bytes -= dropped.sizeBytes;
    }
  }
}

/** One stroke = one undo step. Records the minimum rectangle that actually changed. */
export class StrokeRecorder {
  private readonly before = new Map<string, Uint8ClampedArray>();
  private readonly rects = new Map<string, Rect>();

  constructor(private readonly doc: SpriteDocument, private readonly label: string) {}

  /** Call before the first write to a cel in this stroke. Idempotent per cel. */
  touch(layerId: string, frameId: string): void {
    const key = `${layerId}:${frameId}`;
    if (this.before.has(key)) return;
    this.before.set(key, this.doc.snapshotCel(layerId, frameId));
  }

  /** Call after each write, with the bounds of what was written. */
  extend(layerId: string, frameId: string, rect: Rect): void {
    const key = `${layerId}:${frameId}`;
    this.rects.set(key, rectUnion(this.rects.get(key) ?? null, rect));
  }

  /** Returns null when the stroke changed nothing (e.g. filling with the existing colour). */
  commit(): Command | null {
    const patches: CelPatch[] = [];
    let bytes = 0;

    for (const [key, rect] of this.rects) {
      const [layerId, frameId] = key.split(':');
      const cel = this.doc.getCel(layerId, frameId);
      const before = this.before.get(key);
      if (!cel || !before || rect.w === 0 || rect.h === 0) continue;

      const beforeRegion = cropRegion(before, this.doc.width, rect);
      const afterRegion = cropRegion(cel.pixels, this.doc.width, rect);
      if (regionsEqual(beforeRegion, afterRegion)) continue;

      patches.push({ layerId, frameId, rect, before: beforeRegion, after: afterRegion });
      bytes += beforeRegion.length * 2;
    }

    if (patches.length === 0) return null;
    return new PixelEditCommand(this.doc, this.label, patches, bytes);
  }
}

interface CelPatch {
  layerId: string; frameId: string; rect: Rect;
  before: Uint8ClampedArray; after: Uint8ClampedArray;
}

class PixelEditCommand implements Command {
  constructor(
    private readonly doc: SpriteDocument,
    readonly label: string,
    private readonly patches: CelPatch[],
    readonly sizeBytes: number,
  ) {}

  undo(): void { this.apply('before'); }
  redo(): void { this.apply('after'); }

  private apply(side: 'before' | 'after'): void {
    for (const patch of this.patches) {
      const cel = this.doc.ensureCel(patch.layerId, patch.frameId);
      pasteRegion(cel.pixels, this.doc.width, patch.rect, patch[side]);
      this.doc.markPixelsChanged(cel, patch.rect);
    }
  }
}

function regionsEqual(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
```

### Structural commands

`src/editor/commands/structure.ts` — the pattern for every non-pixel operation. Each is a thin
closure pair over data the document already hands back:

```ts
import type { Command } from '@/editor/history';
import type { DirtyCel, FrameModel, LayerModel, SpriteDocument } from '@/editor/document';

export function addLayerCommand(doc: SpriteDocument, atIndex?: number): Command {
  const layer = doc.addLayer(undefined, atIndex);       // applied immediately
  const index = doc.layerIndex(layer.id);
  return {
    label: 'Add layer',
    sizeBytes: 0,
    undo: () => { doc.removeLayer(layer.id); },
    redo: () => { doc.insertLayer(layer, index); },
  };
}

export function removeLayerCommand(doc: SpriteDocument, layerId: string): Command | null {
  const removed = doc.removeLayer(layerId);
  if (!removed) return null;
  const { layer, index, cels } = removed;
  return {
    label: 'Delete layer',
    sizeBytes: cels.reduce((total, cel) => total + cel.pixels.length, 0),
    undo: () => { doc.insertLayer(layer, index, cels); },
    redo: () => { doc.removeLayer(layer.id); },
  };
}

export function moveFrameCommand(doc: SpriteDocument, from: number, to: number): Command {
  doc.moveFrame(from, to);
  return {
    label: 'Reorder frame',
    sizeBytes: 0,
    undo: () => doc.moveFrame(to, from),
    redo: () => doc.moveFrame(from, to),
  };
}
```

> Convention: command factories **apply the change and return the command**. Callers do
> `const cmd = addLayerCommand(doc); if (cmd) history.push(cmd);`. That keeps the "apply" path and
> the "redo" path from silently diverging, which is the classic command-pattern bug.

## 2.6 Loading, autosave & thumbnails (services)

`src/services/documentService.ts`

```ts
import { SpriteDocument } from '@/editor/document';
import { loadSnapshot, updateSprite } from '@/db/repositories/sprites';
import { saveLayers } from '@/db/repositories/layers';

export async function openDocument(spriteId: string): Promise<SpriteDocument> {
  const { sprite, layers, cels } = await loadSnapshot(spriteId);
  return new SpriteDocument({
    id: sprite.id,
    name: sprite.name,
    width: sprite.width,
    height: sprite.height,
    fps: sprite.fps,
    layers: layers.map(({ id, name, opacity, visible, locked }) => ({ id, name, opacity, visible, locked })),
    frames: sprite.frames.map((frame) => ({ id: frame.id })),
    cels: cels.map(({ layerId, frameId, pixels }) => ({ layerId, frameId, pixels })),
  });
}

/** Persists structure + metadata. Pixels go through the autosave controller separately. */
export async function saveDocumentStructure(doc: SpriteDocument): Promise<void> {
  await saveLayers(doc.layers.map((layer) => ({ ...layer, spriteId: doc.id })));
  await updateSprite(doc.id, {
    name: doc.name,
    width: doc.width,
    height: doc.height,
    fps: doc.fps,
    layerIds: doc.layers.map((layer) => layer.id),
    frames: doc.frames.map((frame) => ({ id: frame.id })),
  });
}
```

`src/services/autosave.ts`

```ts
import { flushCels } from '@/db/repositories/cels';
import { saveDocumentStructure } from '@/services/documentService';
import { AUTOSAVE_DEBOUNCE_MS } from '@/constants/storage';
import type { SpriteDocument } from '@/editor/document';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'error';

export class AutosaveController {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private structureDirty = false;
  private inFlight: Promise<void> | null = null;
  private readonly unsubscribe: (() => void)[] = [];

  constructor(
    private readonly doc: SpriteDocument,
    private readonly onStatus: (status: SaveStatus) => void,
  ) {
    this.unsubscribe.push(doc.events.on('pixels', () => this.schedule()));
    this.unsubscribe.push(doc.events.on('structure', () => { this.structureDirty = true; this.schedule(); }));
    this.unsubscribe.push(doc.events.on('meta', () => { this.structureDirty = true; this.schedule(); }));

    // Tab hide is the only reliably-delivered "about to lose the page" signal.
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  schedule(): void {
    this.onStatus('pending');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), AUTOSAVE_DEBOUNCE_MS);
  }

  /** Awaited on route change and before export. Safe to call concurrently. */
  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.inFlight) return this.inFlight;

    const dirty = this.doc.takeDirtyCels();
    const needsStructure = this.structureDirty;
    this.structureDirty = false;
    if (dirty.length === 0 && !needsStructure) { this.onStatus('idle'); return; }

    this.onStatus('saving');
    this.inFlight = (async () => {
      try {
        if (dirty.length) {
          await flushCels(dirty.map((cel) => ({ ...cel, spriteId: this.doc.id })));
        }
        if (needsStructure) await saveDocumentStructure(this.doc);
        this.onStatus('idle');
      } catch (error) {
        // Put the work back so the next flush retries it rather than losing pixels.
        this.structureDirty ||= needsStructure;
        this.onStatus('error');
        throw error;
      } finally {
        this.inFlight = null;
      }
    })();

    return this.inFlight;
  }

  dispose(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    for (const off of this.unsubscribe) off();
    void this.flush();
  }

  private onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') void this.flush();
  };
}
```

`src/services/thumbnails.ts` — throttled, reuses the compositor from phase 3:

```ts
import { compositeFrame } from '@/editor/composite';
import { updateSprite } from '@/db/repositories/sprites';
import { THUMBNAIL_MAX_PX } from '@/constants/storage';
import type { SpriteDocument } from '@/editor/document';

export async function generateThumbnail(doc: SpriteDocument): Promise<Blob | null> {
  const frame = doc.frames[0];
  if (!frame) return null;

  const source = compositeFrame(doc, frame.id);
  const scale = Math.max(1, Math.floor(THUMBNAIL_MAX_PX / Math.max(doc.width, doc.height)));
  const canvas = new OffscreenCanvas(doc.width * scale, doc.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;   // a blurred pixel-art thumbnail looks broken
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: 'image/png' });
}

export async function saveThumbnail(doc: SpriteDocument): Promise<void> {
  const thumbnail = await generateThumbnail(doc);
  if (thumbnail) await updateSprite(doc.id, { thumbnail });
}
```

## 2.7 React bridge

`src/hooks/useDocumentRevision.ts` — the only correct way for a component to re-render on a
document change. It reads a counter, so the snapshot is always a stable primitive:

```ts
import { useSyncExternalStore } from 'react';
import type { SpriteDocument } from '@/editor/document';

export function useDocumentRevision(doc: SpriteDocument, channel: 'structure' | 'meta'): number {
  return useSyncExternalStore(
    (onChange) => doc.events.on(channel, onChange),
    () => doc.revisions[channel],
  );
}
```

`src/app/DocumentProvider.tsx`

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { SpriteDocument } from '@/editor/document';
import { History } from '@/editor/history';
import { AutosaveController, type SaveStatus } from '@/services/autosave';
import { openDocument } from '@/services/documentService';

interface DocumentSession {
  doc: SpriteDocument;
  history: History;
  autosave: AutosaveController;
  saveStatus: SaveStatus;
}

const DocumentContext = createContext<DocumentSession | null>(null);

export function DocumentProvider({ spriteId, children }: { spriteId: string; children: ReactNode }) {
  const [session, setSession] = useState<DocumentSession | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    let disposed = false;
    let autosave: AutosaveController | null = null;

    void openDocument(spriteId).then((doc) => {
      if (disposed) return;
      autosave = new AutosaveController(doc, setSaveStatus);
      setSession({ doc, history: new History(), autosave, saveStatus: 'idle' });
    });

    return () => {
      disposed = true;
      autosave?.dispose();   // flushes on the way out
      setSession(null);
    };
  }, [spriteId]);

  if (!session) return <EditorSkeleton />;
  return (
    <DocumentContext value={{ ...session, saveStatus }}>{children}</DocumentContext>
  );
}

export function useDocumentSession(): DocumentSession {
  const session = useContext(DocumentContext);
  if (!session) throw new Error('useDocumentSession must be used inside <DocumentProvider>');
  return session;
}
```

> React 19 lets you render `<Context>` directly instead of `<Context.Provider>`; both work.

## 2.8 Tests

`src/editor/history.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { SpriteDocument } from '@/editor/document';
import { History, StrokeRecorder } from '@/editor/history';
import { setPixel } from '@/editor/buffer';

function makeDoc() {
  return new SpriteDocument({
    id: 's', name: 'test', width: 4, height: 4, fps: 12,
    layers: [{ id: 'l1', name: 'Layer 1', opacity: 1, visible: true, locked: false }],
    frames: [{ id: 'f1' }],
    cels: [],
  });
}

describe('stroke history', () => {
  it('restores the exact buffer on undo and reapplies on redo', () => {
    const doc = makeDoc();
    const history = new History();
    const recorder = new StrokeRecorder(doc, 'Pencil');

    recorder.touch('l1', 'f1');
    const cel = doc.ensureCel('l1', 'f1');
    setPixel(cel.pixels, 1, 1, doc.width, { r: 255, g: 0, b: 0, a: 255 });
    recorder.extend('l1', 'f1', { x: 1, y: 1, w: 1, h: 1 });
    doc.markPixelsChanged(cel, { x: 1, y: 1, w: 1, h: 1 });

    const command = recorder.commit();
    expect(command).not.toBeNull();
    history.push(command!);

    history.undo();
    expect(Array.from(cel.pixels)).toEqual(Array.from(new Uint8ClampedArray(64)));

    history.redo();
    expect(cel.pixels[(1 * 4 + 1) * 4]).toBe(255);
  });

  it('returns null for a stroke that changed nothing', () => {
    const doc = makeDoc();
    const recorder = new StrokeRecorder(doc, 'Pencil');
    recorder.touch('l1', 'f1');
    recorder.extend('l1', 'f1', { x: 0, y: 0, w: 2, h: 2 });
    expect(recorder.commit()).toBeNull();
  });
});
```

`src/editor/document.test.ts` — assert: deleting a layer returns its cels and re-inserting
restores them byte-for-byte; the last layer/frame cannot be deleted; `addFrame(i, copyOf)` deep-copies
buffers (mutating the copy must not touch the source); `resize` preserves pixels within bounds.

---

## Done when

- [ ] `openDocument(id)` in the console returns a `SpriteDocument` with the right layers/frames.
- [ ] Writing pixels → waiting 1 s → reloading → `openDocument` returns those pixels.
- [ ] Undo after a stroke restores a byte-identical buffer (test asserts this).
- [ ] Deleting a layer and undoing restores its pixels on every frame.
- [ ] `history.push` past 100 entries drops the oldest and memory stays bounded.
- [ ] `npm run lint` — `src/editor/**` imports nothing from React, Dexie, or `src/db/**`.
