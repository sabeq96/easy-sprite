# Phase 4 — Drawing tools

**Goal:** actually draw. Pixel algorithms, a tool plugin interface, five tools
(pencil, mirror pencil, eraser, bucket, fill-similar, colour picker), the pointer pipeline that
drives them, and the toolbar UI. After this phase the app is usable.

**Est.** 2 days · **Depends on:** phase 3

---

## 4.1 Pixel algorithms

Pure, allocation-free where it matters, and each one returns the `Rect` it touched so the caller
can feed history and dirty-rect redraws without guessing.

`src/editor/pixels.ts`

```ts
import { blendPixel, bufferIndex, getPixel, setPixel } from '@/editor/buffer';
import { rectFromPoints, rectUnion, type Rect } from '@/lib/rect';
import type { RGBA } from '@/lib/color';

export interface PlotTarget {
  buffer: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Per-pixel write callback — lets brushes, lines and fills share one write path. */
export type PixelWriter = (x: number, y: number) => void;

/**
 * Square brush, top-left biased for even sizes (matches Piskel and every other pixel editor).
 * size 1 → [x]; size 2 → [x, x+1]; size 3 → [x-1, x+1]; size 4 → [x-1, x+2].
 */
export function brushBounds(x: number, y: number, size: number): Rect {
  const offset = Math.floor((size - 1) / 2);
  return { x: x - offset, y: y - offset, w: size, h: size };
}

export function forEachBrushPixel(x: number, y: number, size: number, write: PixelWriter): void {
  const { x: startX, y: startY } = brushBounds(x, y, size);
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) write(startX + dx, startY + dy);
  }
}

/** Bresenham — pointer events are sampled, so consecutive points must be joined. */
export function forEachLinePixel(
  x0: number, y0: number, x1: number, y1: number, write: PixelWriter,
): void {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let error = dx + dy;

  for (;;) {
    write(x, y);
    if (x === x1 && y === y1) return;
    const doubled = 2 * error;
    if (doubled >= dy) { error += dy; x += stepX; }
    if (doubled <= dx) { error += dx; y += stepY; }
  }
}

export function colorDistance(a: RGBA, b: RGBA): number {
  // Max-channel distance: predictable for users tuning a 0–255 tolerance slider.
  return Math.max(
    Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b), Math.abs(a.a - b.a),
  );
}

export interface FillOptions {
  tolerance?: number;
  /** false = replace the matching colour everywhere on the layer ("fill similar"). */
  contiguous?: boolean;
  /** Restricts the fill to a selection mask, when one exists. */
  mask?: Uint8Array | null;
}

/**
 * Scan-line flood fill. Iterative (an 128×128 recursive fill blows the stack) and
 * O(pixels) with a visited bitmap rather than re-testing colours.
 */
export function floodFill(
  target: PlotTarget, startX: number, startY: number, color: RGBA, options: FillOptions = {},
): Rect | null {
  const { buffer, width, height } = target;
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return null;

  const tolerance = options.tolerance ?? 0;
  const contiguous = options.contiguous ?? true;
  const seed = getPixel(buffer, startX, startY, width);

  const matches = (x: number, y: number) => {
    if (options.mask && options.mask[y * width + x] === 0) return false;
    return colorDistance(getPixel(buffer, x, y, width), seed) <= tolerance;
  };

  // No-op guard: filling with the colour already there would record an empty undo step.
  if (colorDistance(seed, color) === 0) return null;

  let dirty: Rect | null = null;
  const paint = (x: number, y: number) => {
    setPixel(buffer, x, y, width, color);
    dirty = rectUnion(dirty, { x, y, w: 1, h: 1 });
  };

  if (!contiguous) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) if (matches(x, y)) paint(x, y);
    }
    return dirty;
  }

  const visited = new Uint8Array(width * height);
  const stack: number[] = [startX, startY];

  while (stack.length) {
    const y = stack.pop()!;
    const seedX = stack.pop()!;
    if (visited[y * width + seedX]) continue;

    // Walk left and right to the span edges.
    let left = seedX;
    while (left > 0 && !visited[y * width + left - 1] && matches(left - 1, y)) left--;
    let right = seedX;
    while (right < width - 1 && !visited[y * width + right + 1] && matches(right + 1, y)) right++;

    for (let x = left; x <= right; x++) {
      visited[y * width + x] = 1;
      paint(x, y);
      // Seed the rows above and below this span.
      for (const neighbourY of [y - 1, y + 1]) {
        if (neighbourY < 0 || neighbourY >= height) continue;
        if (!visited[neighbourY * width + x] && matches(x, neighbourY)) stack.push(x, neighbourY);
      }
    }
  }

  return dirty;
}

/** Reads the merged colour under the cursor from an already-composited buffer. */
export function pickColor(target: PlotTarget, x: number, y: number): RGBA | null {
  if (x < 0 || y < 0 || x >= target.width || y >= target.height) return null;
  return getPixel(target.buffer, x, y, target.width);
}

export { blendPixel, bufferIndex, setPixel };
```

`src/editor/pixels.test.ts` — fill a 4×4 with a diagonal wall and assert the fill respects it;
assert `floodFill` with the seed colour returns `null`; assert `forEachLinePixel(0,0,3,1)` yields
the expected 4 points; assert even brush sizes are top-left biased.

## 4.2 The tool interface

`src/editor/tools/types.ts`

```ts
import type { SpriteDocument } from '@/editor/document';
import type { StrokeRecorder } from '@/editor/history';
import type { OverlayPainter } from '@/editor/renderer';
import type { ToolId } from '@/constants/tools';
import type { RGBA } from '@/lib/color';

/** Integer sprite-space pixel. */
export interface ToolPoint { x: number; y: number }

export interface PointerModifiers {
  button: number;    // 0 = primary colour, 2 = secondary colour
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
}

export interface ToolOptions {
  brushSize: number;
  mirrorHorizontal: boolean;
  mirrorVertical: boolean;
  fillTolerance: number;
  fillContiguous: boolean;
  /** Colour picker samples the composite rather than the active layer. */
  pickFromComposite: boolean;
}

export interface ToolContext {
  readonly doc: SpriteDocument;
  readonly layerId: string;
  readonly frameId: string;
  /** Already resolved from the mouse button — tools never read the store. */
  readonly color: RGBA;
  readonly options: ToolOptions;
  readonly stroke: StrokeRecorder;
  /** Null when nothing is selected; otherwise 1 byte per pixel, 1 = editable. */
  readonly mask: Uint8Array | null;

  setColor(color: RGBA): void;
  setOverlay(painter: OverlayPainter | null): void;
}

export interface Tool {
  readonly id: ToolId;
  readonly label: string;
  /** CSS cursor while this tool is active. */
  readonly cursor: string;
  /** Whether a drag continues the operation (pencil) or is a one-shot (bucket). */
  readonly continuous: boolean;

  onPointerDown(ctx: ToolContext, point: ToolPoint, modifiers: PointerModifiers): void;
  onPointerMove?(ctx: ToolContext, point: ToolPoint, previous: ToolPoint, modifiers: PointerModifiers): void;
  onPointerUp?(ctx: ToolContext, point: ToolPoint, modifiers: PointerModifiers): void;
  onCancel?(ctx: ToolContext): void;
}
```

> **Boundary in action:** `Tool` has no `icon` field, because a Lucide icon is a React component
> and `src/editor/**` is React-free. Icons live in `src/components/editor/toolIcons.ts` as
> `Record<ToolId, LucideIcon>`, and the lint rule from phase 0 is what keeps that honest.

## 4.3 Shared write path

Every tool writes through one function, so bounds checking, the selection mask, layer locking and
alpha blending are implemented exactly once.

`src/editor/tools/paint.ts`

```ts
import { blendPixel, setPixel } from '@/editor/buffer';
import { forEachBrushPixel, forEachLinePixel } from '@/editor/pixels';
import { rectUnion, type Rect } from '@/lib/rect';
import type { RGBA } from '@/lib/color';
import type { ToolContext, ToolPoint } from '@/editor/tools/types';

/** Writes one pixel if it is in bounds and inside the selection. Returns true if written. */
export function writePixel(ctx: ToolContext, x: number, y: number, color: RGBA, replace: boolean): boolean {
  const { doc } = ctx;
  if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return false;
  if (ctx.mask && ctx.mask[y * doc.width + x] === 0) return false;

  const cel = doc.ensureCel(ctx.layerId, ctx.frameId);
  // `replace` for the eraser and for fully opaque colours; blend only when it matters.
  if (replace || color.a === 255) setPixel(cel.pixels, x, y, doc.width, color);
  else blendPixel(cel.pixels, x, y, doc.width, color);
  return true;
}

export interface StampOptions {
  color: RGBA;
  size: number;
  replace?: boolean;
  mirrorHorizontal?: boolean;
  mirrorVertical?: boolean;
}

/** One brush stamp, including its mirrored copies. Returns the union rect actually written. */
export function stamp(ctx: ToolContext, point: ToolPoint, options: StampOptions): Rect | null {
  const { doc } = ctx;
  let dirty: Rect | null = null;

  const positions: ToolPoint[] = [point];
  if (options.mirrorHorizontal) positions.push({ x: doc.width - 1 - point.x, y: point.y });
  if (options.mirrorVertical) positions.push({ x: point.x, y: doc.height - 1 - point.y });
  if (options.mirrorHorizontal && options.mirrorVertical) {
    positions.push({ x: doc.width - 1 - point.x, y: doc.height - 1 - point.y });
  }

  for (const position of positions) {
    forEachBrushPixel(position.x, position.y, options.size, (x, y) => {
      if (writePixel(ctx, x, y, options.color, options.replace ?? false)) {
        dirty = rectUnion(dirty, { x, y, w: 1, h: 1 });
      }
    });
  }
  return dirty;
}

/** Stamps along a line, joining sampled pointer positions. */
export function stampLine(
  ctx: ToolContext, from: ToolPoint, to: ToolPoint, options: StampOptions,
): Rect | null {
  let dirty: Rect | null = null;
  forEachLinePixel(from.x, from.y, to.x, to.y, (x, y) => {
    dirty = rectUnion(dirty, stamp(ctx, { x, y }, options) ?? { x, y, w: 0, h: 0 });
  });
  return dirty;
}

/** Records the change and notifies the renderer. Every tool ends its write with this. */
export function commitWrite(ctx: ToolContext, dirty: Rect | null): void {
  if (!dirty || dirty.w === 0) return;
  const cel = ctx.doc.ensureCel(ctx.layerId, ctx.frameId);
  ctx.stroke.extend(ctx.layerId, ctx.frameId, dirty);
  ctx.doc.markPixelsChanged(cel, dirty);
}
```

## 4.4 The tools

`src/editor/tools/pencil.ts`

```ts
import { commitWrite, stamp, stampLine } from '@/editor/tools/paint';
import type { Tool, ToolContext } from '@/editor/tools/types';

function createPencil(id: 'pencil' | 'mirrorPencil', label: string, forceMirror: boolean): Tool {
  return {
    id,
    label,
    cursor: 'crosshair',
    continuous: true,

    onPointerDown(ctx, point) {
      ctx.stroke.touch(ctx.layerId, ctx.frameId);
      commitWrite(ctx, stamp(ctx, point, mirrorOptions(ctx, forceMirror)));
    },

    onPointerMove(ctx, point, previous) {
      commitWrite(ctx, stampLine(ctx, previous, point, mirrorOptions(ctx, forceMirror)));
    },
  };
}

function mirrorOptions(ctx: ToolContext, forceMirror: boolean) {
  return {
    color: ctx.color,
    size: ctx.options.brushSize,
    mirrorHorizontal: forceMirror || ctx.options.mirrorHorizontal,
    mirrorVertical: !forceMirror && ctx.options.mirrorVertical,
  };
}

export const pencilTool = createPencil('pencil', 'Pencil', false);
export const mirrorPencilTool = createPencil('mirrorPencil', 'Mirror pencil', true);
```

`src/editor/tools/eraser.ts`

```ts
import { TRANSPARENT } from '@/lib/color';
import { commitWrite, stamp, stampLine } from '@/editor/tools/paint';
import type { Tool } from '@/editor/tools/types';

// `replace: true` — erasing must zero the pixel, not blend transparency over it.
const options = (size: number) => ({ color: TRANSPARENT, size, replace: true });

export const eraserTool: Tool = {
  id: 'eraser',
  label: 'Eraser',
  cursor: 'crosshair',
  continuous: true,

  onPointerDown(ctx, point) {
    ctx.stroke.touch(ctx.layerId, ctx.frameId);
    commitWrite(ctx, stamp(ctx, point, options(ctx.options.brushSize)));
  },

  onPointerMove(ctx, point, previous) {
    commitWrite(ctx, stampLine(ctx, previous, point, options(ctx.options.brushSize)));
  },
};
```

`src/editor/tools/fill.ts`

```ts
import { floodFill } from '@/editor/pixels';
import { commitWrite } from '@/editor/tools/paint';
import type { Tool } from '@/editor/tools/types';

function createFill(id: 'bucket' | 'fillSimilar', label: string, contiguous: boolean): Tool {
  return {
    id,
    label,
    cursor: 'crosshair',
    continuous: false,     // a drag does not repeat the fill

    onPointerDown(ctx, point) {
      ctx.stroke.touch(ctx.layerId, ctx.frameId);
      const cel = ctx.doc.ensureCel(ctx.layerId, ctx.frameId);
      const dirty = floodFill(
        { buffer: cel.pixels, width: ctx.doc.width, height: ctx.doc.height },
        point.x, point.y, ctx.color,
        { tolerance: ctx.options.fillTolerance, contiguous, mask: ctx.mask },
      );
      commitWrite(ctx, dirty);
    },
  };
}

export const bucketTool = createFill('bucket', 'Paint bucket', true);
export const fillSimilarTool = createFill('fillSimilar', 'Fill similar', false);
```

`src/editor/tools/picker.ts`

```ts
import { compositeFrame } from '@/editor/composite';
import { getPixel } from '@/editor/buffer';
import type { Tool } from '@/editor/tools/types';

export const pickerTool: Tool = {
  id: 'picker',
  label: 'Color picker',
  cursor: 'copy',
  continuous: true,      // dragging keeps sampling, like Piskel

  onPointerDown(ctx, point) { sample(ctx, point); },
  onPointerMove(ctx, point) { sample(ctx, point); },
};

function sample(ctx: Parameters<NonNullable<Tool['onPointerMove']>>[0], point: { x: number; y: number }) {
  const { doc } = ctx;
  if (point.x < 0 || point.y < 0 || point.x >= doc.width || point.y >= doc.height) return;

  if (!ctx.options.pickFromComposite) {
    const cel = doc.getCel(ctx.layerId, ctx.frameId);
    if (cel) ctx.setColor(getPixel(cel.pixels, point.x, point.y, doc.width));
    return;
  }

  // Sampling the merged image is what users expect by default.
  const canvas = compositeFrame(doc, ctx.frameId);
  const context = canvas.getContext('2d');
  const data = context?.getImageData(point.x, point.y, 1, 1).data;
  if (data) ctx.setColor({ r: data[0], g: data[1], b: data[2], a: data[3] });
}
```

`src/editor/tools/index.ts` — the one legal barrel (a registry is its own API):

```ts
import type { ToolId } from '@/constants/tools';
import type { Tool } from '@/editor/tools/types';
import { pencilTool, mirrorPencilTool } from '@/editor/tools/pencil';
import { eraserTool } from '@/editor/tools/eraser';
import { bucketTool, fillSimilarTool } from '@/editor/tools/fill';
import { pickerTool } from '@/editor/tools/picker';
import { selectTool, moveTool } from '@/editor/tools/select';   // phase 5

export const TOOLS: Record<ToolId, Tool> = {
  pencil: pencilTool,
  mirrorPencil: mirrorPencilTool,
  eraser: eraserTool,
  bucket: bucketTool,
  fillSimilar: fillSimilarTool,
  picker: pickerTool,
  select: selectTool,
  move: moveTool,
};

export function getTool(id: ToolId): Tool {
  return TOOLS[id];
}
```

## 4.5 Tool and colour store slices

`src/stores/slices/toolSlice.ts`

```ts
import type { SliceCreator } from '@/stores/slices/types';
import type { ToolOptions } from '@/editor/tools/types';
import { DEFAULT_BRUSH_SIZE, DEFAULT_FILL_TOLERANCE, type ToolId } from '@/constants/tools';

export interface ToolSlice {
  toolId: ToolId;
  /** Restored when a held modifier (Alt) releases. */
  previousToolId: ToolId | null;
  toolOptions: ToolOptions;

  setTool: (toolId: ToolId) => void;
  pushTemporaryTool: (toolId: ToolId) => void;
  popTemporaryTool: () => void;
  setToolOptions: (patch: Partial<ToolOptions>) => void;
  cycleBrushSize: () => void;
}

export const createToolSlice: SliceCreator<ToolSlice> = (set, get) => ({
  toolId: 'pencil',
  previousToolId: null,
  toolOptions: {
    brushSize: DEFAULT_BRUSH_SIZE,
    mirrorHorizontal: false,
    mirrorVertical: false,
    fillTolerance: DEFAULT_FILL_TOLERANCE,
    fillContiguous: true,
    pickFromComposite: true,
  },

  setTool: (toolId) => set({ toolId, previousToolId: null }),
  pushTemporaryTool: (toolId) => {
    if (get().previousToolId) return;                 // already holding one
    set({ previousToolId: get().toolId, toolId });
  },
  popTemporaryTool: () => {
    const previous = get().previousToolId;
    if (previous) set({ toolId: previous, previousToolId: null });
  },
  setToolOptions: (patch) => set(({ toolOptions }) => ({ toolOptions: { ...toolOptions, ...patch } })),
  cycleBrushSize: () => set(({ toolOptions }) => ({
    toolOptions: { ...toolOptions, brushSize: (toolOptions.brushSize % 4) + 1 },
  })),
});
```

`src/stores/slices/colorSlice.ts`

```ts
import type { SliceCreator } from '@/stores/slices/types';
import { type RGBA, packRgba, rgbaToHex, TRANSPARENT } from '@/lib/color';
import { RECENT_COLORS_MAX } from '@/constants/palettes';

export interface ColorSlice {
  primaryColor: RGBA;
  secondaryColor: RGBA;
  recentColors: string[];
  activePaletteId: string | null;

  setPrimaryColor: (color: RGBA) => void;
  setSecondaryColor: (color: RGBA) => void;
  swapColors: () => void;
  resetColors: () => void;
  setActivePalette: (paletteId: string | null) => void;
}

export const createColorSlice: SliceCreator<ColorSlice> = (set) => ({
  primaryColor: { r: 0, g: 0, b: 0, a: 255 },
  secondaryColor: { ...TRANSPARENT },
  recentColors: [],
  activePaletteId: null,

  setPrimaryColor: (primaryColor) => set(({ recentColors }) => ({
    primaryColor,
    recentColors: primaryColor.a === 0
      ? recentColors
      : [rgbaToHex(primaryColor), ...recentColors.filter((hex) => hex !== rgbaToHex(primaryColor))]
          .slice(0, RECENT_COLORS_MAX),
  })),
  setSecondaryColor: (secondaryColor) => set({ secondaryColor }),
  swapColors: () => set(({ primaryColor, secondaryColor }) =>
    ({ primaryColor: secondaryColor, secondaryColor: primaryColor })),
  resetColors: () => set({ primaryColor: { r: 0, g: 0, b: 0, a: 255 }, secondaryColor: { ...TRANSPARENT } }),
  setActivePalette: (activePaletteId) => set({ activePaletteId }),
});

export const colorKey = packRgba;   // re-exported for palette swatch keys
```

## 4.6 The pointer pipeline

This is the hook that turns DOM events into tool calls. It is the only place that builds a
`ToolContext`, and it owns the stroke lifecycle.

`src/hooks/usePointerPaint.ts`

```ts
import { useEffect, type RefObject } from 'react';
import { StrokeRecorder } from '@/editor/history';
import { getTool } from '@/editor/tools';
import { screenToSprite } from '@/editor/viewport';
import type { CanvasRenderer } from '@/editor/renderer';
import type { ToolContext, ToolPoint } from '@/editor/tools/types';
import { useDocumentSession } from '@/app/DocumentProvider';
import { useEditorStore } from '@/stores/useEditorStore';

export function usePointerPaint(
  containerRef: RefObject<HTMLElement | null>,
  renderer: CanvasRenderer | null,
) {
  const { doc, history } = useDocumentSession();

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !renderer) return;

    let active: { recorder: StrokeRecorder; pointerId: number; last: ToolPoint } | null = null;

    const toSprite = (event: PointerEvent): ToolPoint => {
      const rect = element.getBoundingClientRect();
      return screenToSprite(useEditorStore.getState().viewport, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    /** Rebuilt per event so tools always see current store state — it is a plain object, cheap. */
    const buildContext = (recorder: StrokeRecorder, button: number): ToolContext | null => {
      const state = useEditorStore.getState();
      const layerId = state.activeLayerId ?? doc.layers.at(-1)?.id;
      const frameId = state.activeFrameId ?? doc.frames[0]?.id;
      if (!layerId || !frameId) return null;

      const layer = doc.layers.find((candidate) => candidate.id === layerId);
      if (!layer || layer.locked || !layer.visible) return null;   // silently ignore, UI shows why

      return {
        doc,
        layerId,
        frameId,
        color: button === 2 ? state.secondaryColor : state.primaryColor,
        options: state.toolOptions,
        stroke: recorder,
        mask: state.selectionMask,
        setColor: (color) =>
          button === 2 ? state.setSecondaryColor(color) : state.setPrimaryColor(color),
        setOverlay: (painter) => renderer.setOverlayPainter(painter),
      };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 2) return;
      if (event.shiftKey && event.button === 1) return;             // pan, handled elsewhere

      const state = useEditorStore.getState();
      const tool = getTool(state.toolId);
      const recorder = new StrokeRecorder(doc, tool.label);
      const ctx = buildContext(recorder, event.button);
      if (!ctx) return;

      const point = toSprite(event);
      active = { recorder, pointerId: event.pointerId, last: point };
      // Capture so a stroke that leaves the canvas keeps painting until pointerup.
      element.setPointerCapture(event.pointerId);
      tool.onPointerDown(ctx, point, modifiersOf(event));
    };

    const onPointerMove = (event: PointerEvent) => {
      const state = useEditorStore.getState();
      const tool = getTool(state.toolId);

      if (!active) {
        renderer.invalidate('overlay');                              // brush cursor preview
        return;
      }

      const ctx = buildContext(active.recorder, event.button === -1 ? 0 : event.button);
      if (!ctx || !tool.onPointerMove) return;

      // Coalesced events prevent gaps on fast strokes at high refresh rates.
      const events = event.getCoalescedEvents?.() ?? [event];
      for (const sample of events) {
        const point = toSprite(sample);
        if (point.x === active.last.x && point.y === active.last.y) continue;
        tool.onPointerMove(ctx, point, active.last, modifiersOf(sample));
        active.last = point;
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!active) return;
      const state = useEditorStore.getState();
      const tool = getTool(state.toolId);
      const ctx = buildContext(active.recorder, event.button);
      if (ctx) tool.onPointerUp?.(ctx, toSprite(event), modifiersOf(event));

      // One stroke → at most one undo entry.
      const command = active.recorder.commit();
      if (command) history.push(command);

      element.releasePointerCapture(active.pointerId);
      active = null;
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);
    element.addEventListener('contextmenu', preventDefault);        // right-click = secondary colour

    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);
      element.removeEventListener('contextmenu', preventDefault);
    };
  }, [containerRef, renderer, doc, history]);
}

const preventDefault = (event: Event) => event.preventDefault();

const modifiersOf = (event: PointerEvent) => ({
  button: event.button, shift: event.shiftKey, alt: event.altKey, ctrl: event.ctrlKey || event.metaKey,
});
```

### Brush cursor preview

A small overlay painter, installed by the canvas rather than by each tool:

```ts
// src/editor/overlays/brushCursor.ts
import { brushBounds } from '@/editor/pixels';
import type { OverlayPainter } from '@/editor/renderer';
import type { ToolPoint } from '@/editor/tools/types';

export function brushCursorPainter(point: ToolPoint | null, size: number): OverlayPainter {
  return (ctx, viewport) => {
    if (!point) return;
    const bounds = brushBounds(point.x, point.y, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(viewport.originX + bounds.x * viewport.scale) + 0.5,
      Math.round(viewport.originY + bounds.y * viewport.scale) + 0.5,
      bounds.w * viewport.scale,
      bounds.h * viewport.scale,
    );
  };
}
```

## 4.7 Toolbar UI

`src/components/editor/toolIcons.ts` — the React-side half of the tool registry:

```ts
import { Brush, Eraser, FlipHorizontal, PaintBucket, Pipette, Move, SquareDashed, Blend } from 'lucide-react';
import type { ToolId } from '@/constants/tools';
import type { LucideIcon } from 'lucide-react';

export const TOOL_ICONS: Record<ToolId, LucideIcon> = {
  pencil: Brush,
  mirrorPencil: FlipHorizontal,
  eraser: Eraser,
  bucket: PaintBucket,
  fillSimilar: Blend,
  picker: Pipette,
  select: SquareDashed,
  move: Move,
};
```

`src/components/editor/ToolSidebar.tsx`

```tsx
import { TOOL_IDS } from '@/constants/tools';
import { TOOLS } from '@/editor/tools';
import { TOOL_ICONS } from '@/components/editor/toolIcons';
import { SHORTCUT_HINTS } from '@/constants/shortcuts';
import { useEditorStore } from '@/stores/useEditorStore';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ToolSidebar() {
  const toolId = useEditorStore((state) => state.toolId);
  const setTool = useEditorStore((state) => state.setTool);

  return (
    <aside className="flex flex-col items-center gap-1 border-r py-2">
      {TOOL_IDS.map((id) => {
        const Icon = TOOL_ICONS[id];
        return (
          <Tooltip key={id}>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  variant={toolId === id ? 'secondary' : 'ghost'}
                  aria-label={TOOLS[id].label}
                  aria-pressed={toolId === id}
                  onClick={() => setTool(id)}
                >
                  <Icon />
                </Button>
              }
            />
            <TooltipContent side="right">
              {TOOLS[id].label} <kbd className="ml-1 opacity-60">{SHORTCUT_HINTS[id]}</kbd>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </aside>
  );
}
```

`src/components/editor/ToolOptionsBar.tsx` renders only the options the active tool declares —
brush size for pencil/eraser, tolerance + contiguous for the fills, mirror axes for the mirror
pencil. Drive it from a small map rather than a chain of `if`s:

```tsx
const TOOL_OPTION_FIELDS: Record<ToolId, readonly ToolOptionField[]> = {
  pencil: ['brushSize', 'mirror'],
  mirrorPencil: ['brushSize', 'mirrorAxis'],
  eraser: ['brushSize'],
  bucket: ['fillTolerance'],
  fillSimilar: ['fillTolerance'],
  picker: ['pickFromComposite'],
  select: [],
  move: [],
};
```

---

## Done when

- [ ] Pencil draws; fast strokes leave no gaps (Bresenham + coalesced events).
- [ ] Right-drag paints with the secondary colour; the context menu never appears.
- [ ] Brush sizes 1–4 stamp the expected squares, mirrored copies land on the correct axis.
- [ ] Eraser produces truly transparent pixels (checkerboard shows through, `a === 0`).
- [ ] Bucket respects tolerance and does not leak diagonally; fill-similar hits the whole layer.
- [ ] Alt-click picks the composite colour and returns to the previous tool on release.
- [ ] One stroke = one undo step; undoing a 500-pixel stroke is instant.
- [ ] Drawing on a locked or hidden layer does nothing and the layer row says why.
- [ ] `src/editor/tools/**` contains zero React imports.
