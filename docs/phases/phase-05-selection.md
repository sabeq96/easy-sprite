# Phase 5 — Selection, move & clipboard

**Goal:** rectangular selection that constrains drawing, drag-to-move with Alt-to-copy, and
cut/copy/paste that works across sprites.

**Est.** 1 day · **Depends on:** phase 4

---

## 5.1 Model

A selection is **a mask plus its bounding rect**. The mask (`Uint8Array`, one byte per pixel,
1 = selected) is what tools already consult via `ToolContext.mask` — phase 4 wired that in
advance, so constraining drawing to a selection needs no changes to any tool.

There is no persistent "floating layer" mode. A move is:

```
pointerdown inside selection → cut the region out of the cel (unless Alt)
pointermove                  → draw the lifted pixels on the overlay canvas
pointerup                    → stamp them into the cel at the final offset
```

Both the cut and the stamp happen inside a single `StrokeRecorder` stroke, so a drag is exactly
one undo step, and there is no half-committed state to reconcile on tool change, frame change or
route change. Piskel keeps a floating buffer alive across events; that is where most of its
selection edge cases come from, and it buys nothing here.

`src/editor/selection.ts`

```ts
import { cropRegion, clearRegion, pasteRegion } from '@/editor/buffer';
import { rectClamp, type Rect } from '@/lib/rect';
import type { SpriteDocument } from '@/editor/document';

export interface Selection {
  rect: Rect;
  /** width*height bytes, 1 = selected. Rect-only today; shape tools can fill it later. */
  mask: Uint8Array;
}

export interface LiftedRegion {
  rect: Rect;
  pixels: Uint8ClampedArray;
  /** Raster of `pixels`, for cheap overlay drawing while dragging. */
  canvas: OffscreenCanvas;
}

export function createRectSelection(width: number, height: number, rect: Rect): Selection | null {
  const clamped = rectClamp(rect, width, height);
  if (clamped.w <= 0 || clamped.h <= 0) return null;

  const mask = new Uint8Array(width * height);
  for (let y = clamped.y; y < clamped.y + clamped.h; y++) {
    mask.fill(1, y * width + clamped.x, y * width + clamped.x + clamped.w);
  }
  return { rect: clamped, mask };
}

export function selectAll(width: number, height: number): Selection {
  return { rect: { x: 0, y: 0, w: width, h: height }, mask: new Uint8Array(width * height).fill(1) };
}

export function translateSelection(selection: Selection, dx: number, dy: number, width: number, height: number) {
  return createRectSelection(width, height, {
    ...selection.rect, x: selection.rect.x + dx, y: selection.rect.y + dy,
  });
}

/** Copies (and optionally clears) the selected region of one cel. */
export function liftRegion(
  doc: SpriteDocument, layerId: string, frameId: string, selection: Selection, cut: boolean,
): LiftedRegion | null {
  const cel = doc.getCel(layerId, frameId);
  if (!cel) return null;

  const pixels = cropRegion(cel.pixels, doc.width, selection.rect);
  if (cut) {
    clearRegion(cel.pixels, doc.width, selection.rect);
    doc.markPixelsChanged(cel, selection.rect);
  }

  const canvas = new OffscreenCanvas(selection.rect.w, selection.rect.h);
  canvas.getContext('2d')?.putImageData(new ImageData(pixels, selection.rect.w, selection.rect.h), 0, 0);
  return { rect: selection.rect, pixels, canvas };
}

/** Stamps a lifted region back, skipping its transparent pixels so it doesn't punch holes. */
export function stampRegion(
  doc: SpriteDocument, layerId: string, frameId: string, region: LiftedRegion, at: { x: number; y: number },
): Rect | null {
  const target = rectClamp({ ...region.rect, x: at.x, y: at.y }, doc.width, doc.height);
  if (target.w <= 0 || target.h <= 0) return null;

  const cel = doc.ensureCel(layerId, frameId);
  for (let y = 0; y < target.h; y++) {
    for (let x = 0; x < target.w; x++) {
      const source = ((y + (target.y - at.y)) * region.rect.w + (x + (target.x - at.x))) * 4;
      if (region.pixels[source + 3] === 0) continue;         // transparent stays transparent
      const destination = ((target.y + y) * doc.width + (target.x + x)) * 4;
      cel.pixels.set(region.pixels.subarray(source, source + 4), destination);
    }
  }
  doc.markPixelsChanged(cel, target);
  return target;
}

export { pasteRegion };
```

## 5.2 Selection slice

`src/stores/slices/selectionSlice.ts`

```ts
import type { SliceCreator } from '@/stores/slices/types';
import { createRectSelection, selectAll, type Selection } from '@/editor/selection';
import type { Rect } from '@/lib/rect';

export interface SelectionSlice {
  selection: Selection | null;
  /** Mirror of `selection.mask`, read by ToolContext (phase 4). */
  selectionMask: Uint8Array | null;
  /** Live rect while dragging a new selection — overlay only, not yet committed. */
  pendingRect: Rect | null;

  setSelection: (selection: Selection | null) => void;
  setSelectionRect: (rect: Rect, size: { width: number; height: number }) => void;
  setPendingRect: (rect: Rect | null) => void;
  selectAllPixels: (size: { width: number; height: number }) => void;
  clearSelection: () => void;
}

export const createSelectionSlice: SliceCreator<SelectionSlice> = (set) => ({
  selection: null,
  selectionMask: null,
  pendingRect: null,

  setSelection: (selection) => set({ selection, selectionMask: selection?.mask ?? null }),
  setSelectionRect: (rect, size) => {
    const selection = createRectSelection(size.width, size.height, rect);
    set({ selection, selectionMask: selection?.mask ?? null, pendingRect: null });
  },
  setPendingRect: (pendingRect) => set({ pendingRect }),
  selectAllPixels: (size) => {
    const selection = selectAll(size.width, size.height);
    set({ selection, selectionMask: selection.mask });
  },
  clearSelection: () => set({ selection: null, selectionMask: null, pendingRect: null }),
});
```

Selection lives in the store rather than the document because it is **view state**: it is not
saved, not undone, and not shared between sprites.

## 5.3 Select and move tools

`src/editor/tools/select.ts`

```ts
import { createRectSelection, liftRegion, stampRegion, type LiftedRegion, type Selection } from '@/editor/selection';
import { rectContains, rectFromPoints } from '@/lib/rect';
import type { Tool, ToolContext, ToolPoint } from '@/editor/tools/types';
import { marchingAntsPainter, floatingPainter } from '@/editor/overlays/selectionOverlay';

/**
 * Tools are stateless singletons, so per-drag state lives here, scoped to the module.
 * Only one pointer stroke can be active at a time (pointer capture guarantees it).
 */
interface DragState {
  origin: ToolPoint;
  lifted: LiftedRegion | null;
  offset: { x: number; y: number };
}
let drag: DragState | null = null;

/** Injected by the editor so the core does not import the store. */
export interface SelectionBridge {
  get(): Selection | null;
  set(selection: Selection | null): void;
  setPending(rect: { x: number; y: number; w: number; h: number } | null): void;
}
let bridge: SelectionBridge = { get: () => null, set: () => {}, setPending: () => {} };
export function configureSelectionBridge(next: SelectionBridge): void { bridge = next; }

export const selectTool: Tool = {
  id: 'select',
  label: 'Select',
  cursor: 'crosshair',
  continuous: true,

  onPointerDown(ctx, point) {
    drag = { origin: point, lifted: null, offset: { x: 0, y: 0 } };
    bridge.setPending({ ...point, w: 1, h: 1 });
    ctx.setOverlay(marchingAntsPainter(() => bridge.get()?.rect ?? null, () => null));
  },

  onPointerMove(ctx, point) {
    if (!drag) return;
    bridge.setPending(rectFromPoints(drag.origin.x, drag.origin.y, point.x, point.y));
  },

  onPointerUp(ctx, point) {
    if (!drag) return;
    const rect = rectFromPoints(drag.origin.x, drag.origin.y, point.x, point.y);
    // A click without a drag clears the selection — the standard "click to deselect".
    bridge.set(rect.w > 1 || rect.h > 1 ? createRectSelection(ctx.doc.width, ctx.doc.height, rect) : null);
    bridge.setPending(null);
    drag = null;
  },

  onCancel() { drag = null; bridge.setPending(null); },
};

export const moveTool: Tool = {
  id: 'move',
  label: 'Move selection',
  cursor: 'move',
  continuous: true,

  onPointerDown(ctx, point, modifiers) {
    const selection = bridge.get();
    if (!selection || !rectContains(selection.rect, point.x, point.y)) return;

    ctx.stroke.touch(ctx.layerId, ctx.frameId);
    // Alt copies: lift without cutting the source.
    const lifted = liftRegion(ctx.doc, ctx.layerId, ctx.frameId, selection, !modifiers.alt);
    if (!lifted) return;

    drag = { origin: point, lifted, offset: { x: 0, y: 0 } };
    ctx.setOverlay(floatingPainter(() => (drag?.lifted ? { region: drag.lifted, offset: drag.offset } : null)));
  },

  onPointerMove(ctx, point) {
    if (!drag?.lifted) return;
    drag.offset = { x: point.x - drag.origin.x, y: point.y - drag.origin.y };
    ctx.setOverlay(floatingPainter(() => (drag?.lifted ? { region: drag.lifted, offset: drag.offset } : null)));
  },

  onPointerUp(ctx) {
    if (!drag?.lifted) { drag = null; return; }

    const { lifted, offset } = drag;
    const target = { x: lifted.rect.x + offset.x, y: lifted.rect.y + offset.y };
    const written = stampRegion(ctx.doc, ctx.layerId, ctx.frameId, lifted, target);
    if (written) ctx.stroke.extend(ctx.layerId, ctx.frameId, unionOfLiftAndDrop(lifted.rect, written));

    // The selection follows the pixels.
    bridge.set(createRectSelection(ctx.doc.width, ctx.doc.height, { ...lifted.rect, ...target }));
    ctx.setOverlay(null);
    drag = null;
  },

  onCancel(ctx) { ctx.setOverlay(null); drag = null; },
};

function unionOfLiftAndDrop(from: { x: number; y: number; w: number; h: number }, to: typeof from) {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  return { x, y, w: Math.max(from.x + from.w, to.x + to.w) - x, h: Math.max(from.y + from.h, to.y + to.h) - y };
}
```

> The **bridge** pattern is how the React-free core reads view state it cannot import. The editor
> page calls `configureSelectionBridge` once with store accessors. It is a deliberate seam: two
> functions, no coupling, and the tools stay unit-testable with a fake bridge.

## 5.4 Overlay painters

`src/editor/overlays/selectionOverlay.ts`

```ts
import type { OverlayPainter } from '@/editor/renderer';
import type { LiftedRegion } from '@/editor/selection';
import type { Rect } from '@/lib/rect';

const DASH = [4, 4];

/** Marching ants: two offset dashed strokes so it reads on any background. */
export function marchingAntsPainter(
  getRect: () => Rect | null, getPending: () => Rect | null,
): OverlayPainter {
  return (ctx, viewport) => {
    const rect = getPending() ?? getRect();
    if (!rect) return;

    const x = Math.round(viewport.originX + rect.x * viewport.scale) + 0.5;
    const y = Math.round(viewport.originY + rect.y * viewport.scale) + 0.5;
    const w = rect.w * viewport.scale;
    const h = rect.h * viewport.scale;
    const phase = (performance.now() / 60) % 8;   // animates via the renderer's rAF loop

    ctx.lineWidth = 1;
    ctx.setLineDash(DASH);

    ctx.strokeStyle = '#000';
    ctx.lineDashOffset = -phase;
    ctx.strokeRect(x, y, w, h);

    ctx.strokeStyle = '#fff';
    ctx.lineDashOffset = -phase + 4;
    ctx.strokeRect(x, y, w, h);

    ctx.setLineDash([]);
  };
}

export function floatingPainter(
  get: () => { region: LiftedRegion; offset: { x: number; y: number } } | null,
): OverlayPainter {
  return (ctx, viewport) => {
    const state = get();
    if (!state) return;
    const { region, offset } = state;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      region.canvas,
      viewport.originX + (region.rect.x + offset.x) * viewport.scale,
      viewport.originY + (region.rect.y + offset.y) * viewport.scale,
      region.rect.w * viewport.scale,
      region.rect.h * viewport.scale,
    );
  };
}
```

Marching ants need a continuously animating overlay. Rather than a second rAF loop, let the
renderer keep the overlay channel dirty while a selection exists:

```ts
// in CanvasRenderer.render(), after painting the overlay
if (this.overlayAnimating) this.invalidate('overlay');
```

set `overlayAnimating` from `setOverlayPainter(painter, { animate: true })`.

## 5.5 Clipboard

An in-memory clipboard shared by every sprite in the tab — no `navigator.clipboard`, because
system clipboards only carry images, which would lose exact alpha on the round trip.

`src/editor/clipboard.ts`

```ts
import type { Rect } from '@/lib/rect';

export interface ClipboardEntry { rect: Rect; pixels: Uint8ClampedArray }

let entry: ClipboardEntry | null = null;

export function setClipboard(next: ClipboardEntry | null): void {
  entry = next ? { rect: { ...next.rect }, pixels: new Uint8ClampedArray(next.pixels) } : null;
}
export function getClipboard(): ClipboardEntry | null { return entry; }
export function hasClipboard(): boolean { return entry !== null; }
```

`src/editor/commands/selection.ts` — the four operations as undoable commands:

```ts
import { cropRegion, clearRegion, pasteRegion } from '@/editor/buffer';
import { getClipboard, setClipboard } from '@/editor/clipboard';
import type { Command } from '@/editor/history';
import type { SpriteDocument } from '@/editor/document';
import type { Selection } from '@/editor/selection';

interface Target { doc: SpriteDocument; layerId: string; frameId: string }

export function copySelection({ doc, layerId, frameId }: Target, selection: Selection): void {
  const cel = doc.getCel(layerId, frameId);
  if (!cel) return;
  setClipboard({ rect: selection.rect, pixels: cropRegion(cel.pixels, doc.width, selection.rect) });
}

/** Shared by cut and delete: both clear the region, they differ only in filling the clipboard. */
export function clearSelectionCommand(target: Target, selection: Selection, label: string): Command | null {
  const { doc, layerId, frameId } = target;
  const cel = doc.getCel(layerId, frameId);
  if (!cel) return null;

  const before = cropRegion(cel.pixels, doc.width, selection.rect);
  clearRegion(cel.pixels, doc.width, selection.rect);
  doc.markPixelsChanged(cel, selection.rect);

  return {
    label,
    sizeBytes: before.length,
    undo: () => {
      pasteRegion(cel.pixels, doc.width, selection.rect, before);
      doc.markPixelsChanged(cel, selection.rect);
    },
    redo: () => {
      clearRegion(cel.pixels, doc.width, selection.rect);
      doc.markPixelsChanged(cel, selection.rect);
    },
  };
}

export function pasteCommand(target: Target): Command | null {
  const clip = getClipboard();
  if (!clip) return null;

  const { doc, layerId, frameId } = target;
  const cel = doc.ensureCel(layerId, frameId);
  // Paste at the original position, nudged in-bounds if the canvas shrank or the sprite differs.
  const rect = {
    ...clip.rect,
    x: Math.min(clip.rect.x, Math.max(0, doc.width - clip.rect.w)),
    y: Math.min(clip.rect.y, Math.max(0, doc.height - clip.rect.h)),
  };
  const before = cropRegion(cel.pixels, doc.width, rect);

  const apply = () => { pasteRegion(cel.pixels, doc.width, rect, clip.pixels); doc.markPixelsChanged(cel, rect); };
  apply();

  return {
    label: 'Paste',
    sizeBytes: before.length * 2,
    undo: () => { pasteRegion(cel.pixels, doc.width, rect, before); doc.markPixelsChanged(cel, rect); },
    redo: apply,
  };
}
```

Paste replaces the destination region wholesale (rather than compositing over it), which matches
every pixel editor and makes undo a single rectangle swap.

## 5.6 Wiring

`src/hooks/useSelectionBridge.ts` — called once from `EditorCanvas`:

```ts
import { useEffect } from 'react';
import { configureSelectionBridge } from '@/editor/tools/select';
import { useEditorStore } from '@/stores/useEditorStore';

export function useSelectionBridge() {
  useEffect(() => {
    configureSelectionBridge({
      get: () => useEditorStore.getState().selection,
      set: (selection) => useEditorStore.getState().setSelection(selection),
      setPending: (rect) => useEditorStore.getState().setPendingRect(rect),
    });
  }, []);
}
```

Selection lifecycle rules, enforced in one place (`useSelectionLifecycle`):

| Event | Effect |
| --- | --- |
| Switch frame or layer | selection kept (it is geometry, not content) |
| Canvas resized | selection cleared |
| Sprite closed | selection cleared |
| `Escape` | selection cleared |
| Draw with a non-selection tool | drawing is masked, selection kept |

---

## Done when

- [ ] Drag with `S` draws animated marching ants; click-without-drag deselects.
- [ ] With a selection active, pencil and bucket only affect pixels inside it.
- [ ] `M` + drag moves the pixels, leaving transparency behind; Alt+drag copies instead.
- [ ] A drag that leaves the canvas clamps at the edge and does not corrupt the buffer.
- [ ] One drag = one undo step; undo restores both the source and the destination.
- [ ] Copy in one sprite, open another, paste — the pixels arrive with exact alpha.
- [ ] `Ctrl+A`, `Delete`, `Ctrl+X`, `Ctrl+C`, `Ctrl+V` all behave and all undo.
