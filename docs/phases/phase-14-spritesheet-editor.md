# Phase 14 — Spritesheet composer: row layout, zoom & responsive shell

**Goal:** replace the composer's free `x`/`y` placement with an ordered **row model**, so a sheet
packs itself: sprites sit flush left in their row with no column gap, rows stack with no row gap,
and dragging reorders instead of positioning. On top of that model: a full-size zoomable sheet with
`−`/`+`/fit and a visible zoom level, a ruler grid on by default, and a header that survives a
narrow window.

**Est.** 1.5–2 d · **Depends on:** 9, 10 · **Status:** implemented. §14.6 describes the drag layer as built; the code snippets elsewhere are abridged — the source is canonical.

---

## 14.0 Why the model has to change first

Every symptom in the brief traces back to one decision: blocks store absolute coordinates.

| Symptom | Root cause |
| --- | --- |
| Sprites don't snap left; gaps stay behind | `x`/`y` are user-authored, so nothing owns "flush left" |
| No reorder-on-drag-over | There is no order to change — only coordinates |
| Dropzone is a fixed 480×480 | The sheet's size is `max(480, bounds × BUILDER_ZOOM)`, a placement surface rather than a document |
| Zoom is a constant | `BUILDER_ZOOM = 4` is baked into three files |
| Export button clipped | `InlineNameField` is `w-48` with no `min-w-0`, so it can't shrink and the `ml-auto` group is pushed past the panel edge, which the page's `overflow-hidden` then clips |

So: **position becomes derived.** `blocks` is an ordered list, each block carries a row index, and
the packer computes `x`/`y`. Overlap becomes structurally impossible, which deletes the composer's
old drop rule ("a snapped drop that would overlap another block is rejected") entirely.

### The one invariant

On screen, rows are **flex containers** — the browser lays out what you see. For export, `packSheet`
computes the same geometry in arithmetic. These two must agree, always:

```
row y      = sum of preceding rows' heights          (flex-col, no gap)
row height = tallest block in that row               (items-start)
block x    = sum of preceding blocks' widths in row   (flex-row, no gap)
sheet w/h  = widest row × total height
```

§14.9 pins this down with a test that reads the DOM rects back and compares them to `packSheet`.
Everything else in this phase is downstream of that invariant — which is also why zoom is a **size
multiplier** (`width = spritePx × zoom`) and never a CSS `transform: scale`: a scaled droppable
breaks dnd-kit's rect math, and the portalled `DragOverlay` would render at 1× over a 4× sheet.

**No migration.** The app is pre-production; `SpritesheetBlockRecord` is rewritten in place with no
Dexie upgrade. Dev databases with placed blocks will have them collapse into row 0 — clear those
sheets by hand.

---

## 14.1 Files

**Added**

| File | What it holds |
| --- | --- |
| `src/lib/sheetRows.ts` | Row algebra: `toRows`, `fromRows`, `placeBlock`, `insertRow`, `dropBlock` |
| `src/stores/useBuilderViewStore.ts` | Zoom, grid toggle, grid cell, container size |
| `src/hooks/useBuilderViewport.ts` | ⌘/ctrl+wheel zoom, `ResizeObserver` → `containerSize` |
| `src/hooks/useOptimisticOrder.ts` | Renders a proposed list until the next live read arrives |
| `src/hooks/useSpriteSizes.ts` | Every sprite's block footprint, from records (not documents) |
| `src/hooks/useDocumentCache.ts` | Moved out of the page; keyed on the id *set*, so drag re-renders don't cancel loads |
| `src/components/builder/BuilderRow.tsx` | One row's `SortableContext` + the row gutters |
| `src/components/builder/BuilderViewControls.tsx` | `−` `4×` `+` fit, grid popover |
| `src/components/builder/BuilderStatusBar.tsx` | `W×H · n sprites · n rows · 400%` |
| `tests/unit/lib/sheetRows.test.ts` | Row algebra |

**Edited**

| File | Change |
| --- | --- |
| `src/constants/builder.ts` | Rewritten: zoom ladder, grid cells, gutter size. `BUILDER_ZOOM`/`BUILDER_GRID_SIZE` deleted |
| `src/db/schema.ts` | `SpritesheetBlockRecord`: `x`/`y` → `row` |
| `src/export/spritesheetBuilderLayout.ts` | Rewritten: `packSheet` + size adapters. `blockRect`/`findFreePosition` deleted |
| `src/export/spritesheetBuilder.ts` | Draws from `packSheet` instead of `block.x`/`block.y` |
| `src/services/thumbnails.ts` | Same, via `computeBuilderBounds` |
| `package.json` | `@dnd-kit/core`/`sortable`/`utilities` out; `@dnd-kit/react`/`helpers`/`dom`/`abstract`/`collision` in, pinned `0.5.0` |
| `src/hooks/useDnd.ts` | Rewritten on `@dnd-kit/react` — §14.6 |
| `src/components/common/DragBoard.tsx` | Rewritten on `DragDropProvider` + `DragOverlay` — §14.6 |
| `src/components/editor/FramesBar.tsx`, `FrameCard.tsx` | Commit `initialIndex → index`; the card is now the `<li>` |
| `src/components/editor/LayersPanel.tsx`, `LayerRow.tsx` | Same, mapping the display index back to a layer id |
| `src/components/editor/PalettePanel.tsx`, `ActiveColors.tsx` | Library-sorted reorder, live stand-in for colors copied in, `useOptimisticOrder` |
| `src/db/repositories/sprites.ts` | Deleting a sprite strips its blocks through `fromRows`, so an emptied row collapses |
| `src/components/common/InlineNameField.tsx` | `min-w-0` — the actual clipping fix, and the editor header has the same latent bug |
| `src/components/builder/SpritesheetBuilderPage.tsx` | Responsive header, status bar row, new wiring |
| `src/components/builder/BuilderCanvas.tsx` | Rewritten: scrolling full-size sheet, grid overlay, rows |
| `src/components/builder/BuilderBlock.tsx` | Rewritten: sortable, in flow, zoom-sized, hover caption |
| `src/components/builder/BuilderPalette.tsx` | Becomes a drop zone — a block dragged onto it is removed |
| `src/components/builder/useBuilderDnd.ts` | Rewritten: row targeting, preview injection, persistence |

**Tests rewritten** — `tests/unit/export/spritesheetBuilderLayout.test.ts`,
`tests/unit/db/repositories/spritesheets.test.ts`, `tests/browser/export/spritesheetBuilder.browser.test.tsx`,
`tests/browser/flows/spritesheet-builder.browser.test.tsx`,
`tests/browser/flows/spritesheet-drag.browser.test.tsx`, plus one new case in
`tests/browser/flows/dnd-visuals.browser.test.tsx`. Three screenshot baselines are regenerated.

---

## 14.2 Constants and schema

`src/constants/builder.ts` — fully replaced:

```ts
/** On-screen display scales. Sprite-resolution px are too small to drag comfortably at 1×. */
export const BUILDER_ZOOM_LEVELS = [1, 2, 3, 4, 6, 8] as const;
export const DEFAULT_BUILDER_ZOOM = 4;

/**
 * Ruler grid cell, in sprite px. Blocks pack tight, so a block may straddle a grid line — the
 * grid is there to read row alignment and "no gap" off, not a snap target. Snapping is structural
 * now: a block's position is its place in a row, so there are no off-grid coordinates to snap.
 */
export const BUILDER_GRID_CELLS = [4, 8, 16, 32] as const;
export const DEFAULT_BUILDER_GRID_CELL = 16;

/** Below this many screen px per cell the ruler is noise, hidden regardless of the toggle. */
export const BUILDER_GRID_MIN_SCALE = 6;

/** Theme-independent, matching the pixel editor's grid (see `renderer.drawGrid`). */
export const BUILDER_GRID_LINE = "rgba(128,128,128,0.35)";

/** Pointer slack either side of a row boundary that means "new row" rather than "join that row". */
export const ROW_GUTTER_PX = 8;
```

`src/db/schema.ts`:

```ts
export interface SpritesheetBlockRecord {
  /** Block instance id — not the sprite id, so one sprite could appear more than once. */
  id: string;
  spriteId: string;
  /**
   * 0-based row on the sheet. Rows are gapless (an emptied row collapses) and a block's position
   * *within* its row is this array's own order — the sheet has no coordinates at all.
   */
  row: number;
}
```

---

## 14.3 Row algebra — `src/lib/sheetRows.ts`

Pure, no React, no DB. Every mutation goes out through `fromRows`, which is what makes "no empty
rows, ever" true by construction rather than by remembering to tidy up.

```ts
import type { SpritesheetBlockRecord } from "@/db/schema";

export type SheetRows = SpritesheetBlockRecord[][];

/** Blocks → rows, indexed by row. Order inside a row is the array's own order. */
export function toRows(blocks: SpritesheetBlockRecord[]): SheetRows {
  const count = blocks.reduce((max, block) => Math.max(max, block.row + 1), 0);
  const rows: SheetRows = Array.from({ length: count }, () => []);
  for (const block of blocks) rows[block.row].push(block);
  return rows;
}

/**
 * Rows → blocks: drops empty rows and rewrites every row index, so rows stay 0..n with no holes.
 *
 * This is the only writer of `row`, which is why callers below never set it themselves. Blocks
 * whose row did not change are returned by identity, so React keys and dnd-kit's own measurement
 * cache survive a reorder that did not touch them.
 */
export function fromRows(rows: SheetRows): SpritesheetBlockRecord[] {
  return rows
    .filter((row) => row.length > 0)
    .flatMap((row, index) =>
      row.map((block) => (block.row === index ? block : { ...block, row: index })),
    );
}

export interface RowTarget {
  row: number;
  /** Insertion point within the row, in dnd-kit's `arrayMove` sense — see §14.5. */
  index: number;
}

/** Moves an existing block, or inserts a new one, so it sits at `target` — then renormalises. */
export function placeBlock(
  blocks: SpritesheetBlockRecord[],
  block: SpritesheetBlockRecord,
  target: RowTarget,
): SpritesheetBlockRecord[] {
  const rows = toRows(blocks).map((row) => row.filter((entry) => entry.id !== block.id));
  while (rows.length <= target.row) rows.push([]);
  const row = rows[target.row];
  row.splice(Math.min(Math.max(target.index, 0), row.length), 0, block);
  return fromRows(rows);
}

/** Inserts a new row at `row`, pushing the rows at and below it down, with `block` alone in it. */
export function insertRow(
  blocks: SpritesheetBlockRecord[],
  block: SpritesheetBlockRecord,
  row: number,
): SpritesheetBlockRecord[] {
  const rows = toRows(blocks).map((entry) => entry.filter((other) => other.id !== block.id));
  rows.splice(Math.min(Math.max(row, 0), rows.length), 0, [block]);
  return fromRows(rows);
}

/** Removes a block, collapsing its row if it was the last one in it. */
export function dropBlock(
  blocks: SpritesheetBlockRecord[],
  blockId: string,
): SpritesheetBlockRecord[] {
  return fromRows(toRows(blocks).map((row) => row.filter((block) => block.id !== blockId)));
}
```

Two behaviours fall out of `fromRows` for free, and both are what the brief asks for:

- Dragging the only block of row 0 into the empty row below leaves it in row 0 — a sheet can never
  open with a blank first row.
- Removing the last block of a middle row pulls every row below it up by one.

---

## 14.4 The packer — `src/export/spritesheetBuilderLayout.ts`

Rewritten. `blockRect` and `findFreePosition` are deleted (nothing places by coordinate any more).

Sizes come in through a map rather than being read off documents, because the UI needs a block's
footprint *before* its document has loaded — and a sprite record already knows it. Same packer, two
adapters:

```ts
import type { SpritesheetBlockRecord, SpriteRecord } from "@/db/schema";
import type { SpriteDocument } from "@/editor/document";
import { toRows } from "@/lib/sheetRows";
import type { Rect } from "@/lib/rect";

/** A block's footprint: its sprite's frames laid out as one horizontal strip. */
export interface BlockSize {
  w: number;
  h: number;
}
export type BlockSizes = ReadonlyMap<string, BlockSize>;

export function sizesFromDocs(docs: ReadonlyMap<string, SpriteDocument>): BlockSizes {
  return new Map(
    [...docs].map(([id, doc]) => [id, { w: doc.width * doc.frames.length, h: doc.height }]),
  );
}

/** The UI's source: a record knows its size the moment the library query returns. */
export function sizesFromRecords(sprites: SpriteRecord[]): BlockSizes {
  return new Map(
    sprites.map((sprite) => [
      sprite.id,
      { w: sprite.width * sprite.frames.length, h: sprite.height },
    ]),
  );
}

export interface PackedBlock extends Rect {
  id: string;
  spriteId: string;
  row: number;
}

export interface PackedSheet {
  blocks: PackedBlock[];
  /** One rect per row, in order — the status bar's row count and the export bounds read these. */
  rows: Rect[];
  width: number;
  height: number;
}

/**
 * The sheet's geometry, and the only place it is computed: rows stack top-down with no gap, blocks
 * sit left-to-right inside a row with no gap, and a row is as tall as its tallest block.
 *
 * This mirrors in arithmetic exactly what the composer's flex rows do in CSS. The browser lays out
 * what you see; this lays out what gets exported; §14.9 holds them together.
 */
export function packSheet(blocks: SpritesheetBlockRecord[], sizes: BlockSizes): PackedSheet {
  const packed: PackedBlock[] = [];
  const rows: Rect[] = [];
  let y = 0;

  for (const row of toRows(blocks)) {
    let x = 0;
    let height = 0;

    for (const block of row) {
      const size = sizes.get(block.spriteId);
      if (!size) continue; // record not read yet, or a dangling reference — skip defensively
      packed.push({ id: block.id, spriteId: block.spriteId, row: rows.length, ...size, x, y });
      x += size.w;
      height = Math.max(height, size.h);
    }

    rows.push({ x: 0, y, w: x, h: height });
    y += height;
  }

  return { blocks: packed, rows, width: Math.max(0, ...rows.map((rect) => rect.w)), height: y };
}

/** Kept for the callers that only need the sheet's size. */
export function computeBuilderBounds(
  blocks: SpritesheetBlockRecord[],
  sizes: BlockSizes,
): { width: number; height: number } {
  const { width, height } = packSheet(blocks, sizes);
  return { width, height };
}
```

`src/export/spritesheetBuilder.ts` then draws from the packed list — note the loop now walks
`sheet.blocks` (row-major) rather than the record order, so the exported metadata reads in the same
order as the sheet:

```ts
const sizes = sizesFromDocs(docs);
const sheet = packSheet(blocks, sizes);
const width = Math.max(1, Math.round(sheet.width * scale));
const height = Math.max(1, Math.round(sheet.height * scale));
…
for (const packed of sheet.blocks) {
  const doc = docs.get(packed.spriteId);
  if (!doc) continue;

  const strip = renderSpriteStrip(doc, { includeHidden: options.includeHidden });
  const destX = packed.x * scale;
  const destY = packed.y * scale;
  ctx.drawImage(strip, destX, destY, strip.width * scale, strip.height * scale);
  …
}
```

`src/services/thumbnails.ts` changes by one line —
`computeBuilderBounds(blocks, sizesFromDocs(docs))`.

---

## 14.5 View state

### `src/stores/useBuilderViewStore.ts`

Separate from `useEditorStore` on purpose: that store's viewport carries a pan origin and clamps
tied to one sprite's dimensions, and the composer route has no document at all. Session-only, like
the editor's own zoom.

```ts
import { create } from "zustand";
import {
  BUILDER_ZOOM_LEVELS,
  DEFAULT_BUILDER_GRID_CELL,
  DEFAULT_BUILDER_ZOOM,
} from "@/constants/builder";
import { stepLadder } from "@/lib/math";
import type { Size } from "@/editor/viewport";

export interface BuilderViewState {
  zoom: number;
  gridEnabled: boolean;
  gridCell: number;
  /** Last known size of the scrolling sheet panel, so `fit` needs no DOM read at click time. */
  containerSize: Size;

  setZoom: (zoom: number) => void;
  zoomBy: (direction: 1 | -1) => void;
  fit: (sheet: Size) => void;
  toggleGrid: () => void;
  setGridCell: (cell: number) => void;
  setContainerSize: (size: Size) => void;
}

export const useBuilderViewStore = create<BuilderViewState>()((set) => ({
  zoom: DEFAULT_BUILDER_ZOOM,
  // On by default: the whole point of the grid here is to see at a glance that sprites sit flush.
  gridEnabled: true,
  gridCell: DEFAULT_BUILDER_GRID_CELL,
  containerSize: { width: 0, height: 0 },

  setZoom: (zoom) => set({ zoom }),
  zoomBy: (direction) =>
    set(({ zoom }) => ({ zoom: stepLadder(zoom, BUILDER_ZOOM_LEVELS, direction) })),

  fit: (sheet) =>
    set(({ containerSize }) => {
      if (!sheet.width || !sheet.height || !containerSize.width) {
        return { zoom: DEFAULT_BUILDER_ZOOM };
      }
      const raw = Math.min(containerSize.width / sheet.width, containerSize.height / sheet.height);
      return { zoom: [...BUILDER_ZOOM_LEVELS].reverse().find((level) => level <= raw) ?? BUILDER_ZOOM_LEVELS[0] };
    }),

  toggleGrid: () => set(({ gridEnabled }) => ({ gridEnabled: !gridEnabled })),
  setGridCell: (gridCell) => set({ gridCell }),
  setContainerSize: (containerSize) => set({ containerSize }),
}));
```

### `src/hooks/useBuilderViewport.ts`

```ts
/**
 * ⌘/ctrl+wheel zooms the sheet; a plain wheel keeps scrolling it, because unlike the pixel canvas
 * the sheet genuinely overflows and scrolling is the more common intent. The panel also reports its
 * own size here, so "fit to window" is a pure store read.
 */
export function useBuilderViewport(panelRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = panelRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      // passive:false — the browser's own page zoom must be prevented over the sheet.
      event.preventDefault();
      useBuilderViewStore.getState().zoomBy(event.deltaY < 0 ? 1 : -1);
    };

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      useBuilderViewStore.getState().setContainerSize({ width, height });
    });

    element.addEventListener("wheel", onWheel, { passive: false });
    observer.observe(element);

    return () => {
      element.removeEventListener("wheel", onWheel);
      observer.disconnect();
    };
  }, [panelRef]);
}
```

### `src/hooks/useSpriteSizes.ts`

```ts
/** Every sprite's block footprint, keyed by sprite id — available before any document loads. */
export function useSpriteSizes(): BlockSizes {
  const sprites = useLiveQuery(() => db.sprites.toArray(), [], []);
  return sizesFromRecords(sprites);
}
```

### `src/hooks/useOptimisticOrder.ts`

Extracted from the pattern `PalettePanel` proved (that copy stays as it is — its dedupe/insert
semantics differ, and porting it is a separate change).

```ts
export interface OptimisticOrder<T> {
  /** What to render: the proposed list while it stands, otherwise what the store says. */
  items: T[];
  /** Render this immediately; it stands until the next live read arrives, whatever it contains. */
  propose: (items: T[]) => void;
}

/**
 * A write goes to Dexie and only comes back through useLiveQuery a few async ticks later — long
 * enough to watch a dropped block return to its old slot and animate over again. Rendering the
 * proposed list straight away makes the drop land where it was released.
 *
 * `stored` is only a new reference when the live query actually re-ran, so identity is an exact
 * "has the read caught up yet". Adjusting state during render rather than in an effect keeps a
 * competing edit — another tab, another drag — from ever flashing the stale guess first:
 * https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-based-on-a-prop-change
 */
export function useOptimisticOrder<T>(stored: T[]): OptimisticOrder<T> {
  const [guess, setGuess] = useState<T[] | null>(null);
  const [seen, setSeen] = useState(stored);

  if (stored !== seen) {
    setSeen(stored);
    if (guess) setGuess(null);
  }

  return { items: guess ?? stored, propose: setGuess };
}
```

---

## 14.6 Drag and drop — on `@dnd-kit/react`

Midway through planning, the app moved from legacy `@dnd-kit/core` 6 + `@dnd-kit/sortable` 10
(source on the `master` branch of clauderic/dnd-kit, last released December 2024) to the rewrite,
`@dnd-kit/react` 0.5 (the `main` branch). The rewrite ships the hard part of this phase — sortable
lists that reorder the DOM live while a drag is in flight — so the whole app was migrated, not just
the composer. All `@dnd-kit/*` packages are pinned to exactly `0.5.0`: the library relies on
`instanceof` checks across its packages, and two copies of one would break them silently.

### The shared layer

`src/hooks/useDnd.ts` and `src/components/common/DragBoard.tsx` keep the API every surface already
used, re-implemented on the new library:

| Piece | What it does now |
| --- | --- |
| `APP_DND_SENSORS` | Pointer (4px activation distance) + keyboard. `preventActivation` is narrowed to text entry — the library's default also refuses a pointerdown on a `<button>` inside a draggable, and a frame card *is* its thumbnail button |
| `DragBoard` | `DragDropProvider` + one `DragOverlay` whose child is the site's own preview. Props: `onDragStart?`, `onDragOver?`, `onDrop`, `animateDrop?`, `renderPreview`. `items`/`strategy`/`collisionDetection` are gone — sortables no longer need a context |
| `useSortableItem(id, { index, group?, collision?, data? })` | `useSortable`. The ref must sit on the list's **direct child**: optimistic sorting moves that element among its siblings (which is why `FrameCard`'s root became the `<li>`) |
| `useDragSource(id, { data? })` | `useDraggable`, for copy-in sources |
| `useDropZone({ id, owns?, priority?, ringOnly?, collision? })` | `useDroppable` + a drag monitor for the ring. `priority` maps to `CollisionPriority` (low for a container behind its items, highest for gutters) |
| `collision` | `default` (pointer, else any overlap with the preview's box), `nearest` (`closestCenter` — frames and layers, matching v6's default), `pointer` (`pointerIntersection` — every composer target, so an 80px dock tile never "overlaps" a strip the pointer isn't on) |

Source styling uses `isDragSource`, not `isDragging`: with an overlay, the library never marks the
source itself as dragging. Tests find items by `data-drag-item="sortable" | "source"`.

### Per surface

| Surface | Model |
| --- | --- |
| Frames, layers | Single list. The library reorders live and restores on cancel; `onDrop` commits `initialIndex → index` |
| Palette — reorder, drag out | Same, plus: dropped with no target → the swatch is removed |
| Palette — copy a color in (used swatch, primary/secondary) | Not a sortable, so the library opens no gap for it. `onDragOver` injects an `incoming` stand-in (half-opaque) at the hovered slot; `onDrop` upserts it there. Now on `useOptimisticOrder`, so an added color no longer flickers out while Dexie round-trips |
| Composer | Multiple lists — below |

### The composer

`useBuilderDnd` renders from stored blocks between drags, and from a **row draft** during one:
`Record<"row-0" | …, blockId[]>` with a trailing empty row, keys fixed from drag start to drop (a row
emptied mid-drag stays an empty list, so nothing renumbers under the library — a row's key is its
sortable `group`). `fromRows` collapses empties on commit.

| Drag | Over | During the drag | On drop |
| --- | --- | --- | --- |
| Block or ghost | a block (any row) | `placeBeside` — before or after it, by which half the pointer is in | commit the draft |
| Block or ghost | a row's empty stretch | `appendToRow` | commit the draft |
| Block | gutter / dock / nothing | stays where it last was — unmounting a drag source mid-drag isn't safe | gutter → `withNewRow`; dock → removed; nothing → commit the draft |
| Dock sprite | anything on the sheet | a **ghost** block, id minted at drag start, placed like a block | ghost becomes a real block |
| Dock sprite | gutter / dock / nothing | ghost removed, row closes up | gutter → new row; otherwise nothing |
| Any | Escape | — | draft discarded |

One rule for every placement, made by the composer itself: the library's optimistic sort is turned
off (`preventDefault` in `onDragOver`), because it swaps the moment the pointer *enters* a neighbour —
a drop just inside a block's right half would land before it within a row but after it across rows.
Since `onDragOver` fires only when the target changes, placement is re-run on every `onDragMove`
(which must *not* call `preventDefault` — on a move that stops the drag following the pointer), and
once more at release, because pointer moves are processed a frame at a time and a quick release can
arrive before the last one was.

**Held row heights.** During a drag every row keeps the tallest height it has had since the drag
began. Without it, a row emptied mid-drag (or left by a tall ghost) collapses, the rows below slide up
under the pointer, and the next move carries the block one row further than aimed.

**Gutters** are `pointer-events-none` (collisions are measured from rects, so they still win a drag
without swallowing the press that starts one on a block) and reach at most 4px, and never more than a
quarter of a row's height, into each neighbour — so an 8px row at 1× keeps a middle you can join.

**Small blocks** (under 48 screen px either way) draw no ✕ or caption — they would cover the whole
block, which is its own drag handle. The ✕ stays in place and keyboard-reachable — invisible and
click-through until it has keyboard focus — and carries `data-no-drag` so pressing it never starts a
drag.

**The overlay** is `position: fixed` at rest too; otherwise its empty element is one more item in the
page grid, and the dock jumps 8px every time a drag starts and ends.

"What the drag showed is what lands" is the rule throughout: the only drop that does something the
draft didn't already show is a gutter (a new row) or the dock (removal). The handlers read the draft
from a ref, not state, because the library runs `onDragOver`/`onDragEnd` inside a transition and a
quick release can land before the last update has rendered.

The ghost's document is opened as soon as it is shown (the document cache is keyed on everything the
sheet *shows*), so a dragged-in sprite usually renders its real pixels before it is dropped.

## 14.7 Components

### `BuilderCanvas` — the full-size sheet

```tsx
export function BuilderCanvas({ blocks, sizes, docs, ghost, onRemoveBlock }: BuilderCanvasProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useBuilderViewport(panelRef);
  const rows = toRows(blocks);

  return (
    <Panel variant="secondary" render={<div ref={panelRef} />} className="min-h-0 flex-1 overflow-auto p-4">
      {/*
        w-max min-w-full: rows stretch to at least the panel's width so a drop anywhere along a
        row's band joins that row, and grow past it when the row's blocks are wider than the panel.
        min-h-full gives the trailing row's flex-1 something to fill, which is what makes the whole
        empty area below the sheet a live drop target rather than dead space.
      */}
      <div data-testid="builder-canvas" className="relative flex w-max min-w-full min-h-full flex-col">
        <BuilderGrid />

        {rows.map((row, index) => (
          // Index keys: a row *is* its position — it has no identity and no state of its own, and
          // its children are keyed by block id. Keying by the first block would remount the row
          // (and its SortableContext) mid-drag every time the leading block changed.
          <Fragment key={index}>
            <RowGutter row={index} />
            <BuilderRow row={index} blocks={row} sizes={sizes} docs={docs} ghost={ghost} onRemoveBlock={onRemoveBlock} />
          </Fragment>
        ))}

        <RowGutter row={rows.length} />
        <TrailingRow row={rows.length} isEmpty={rows.length === 0} />
      </div>
    </Panel>
  );
}

/** The ruler. Infinite by construction: a repeating gradient over the whole scrollable sheet. */
function BuilderGrid() {
  const gridEnabled = useBuilderViewStore((state) => state.gridEnabled);
  const gridCell = useBuilderViewStore((state) => state.gridCell);
  const zoom = useBuilderViewStore((state) => state.zoom);

  const cell = gridCell * zoom;
  if (!gridEnabled || cell < BUILDER_GRID_MIN_SCALE) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `repeating-linear-gradient(to right, ${BUILDER_GRID_LINE} 0 1px, transparent 1px ${cell}px), repeating-linear-gradient(to bottom, ${BUILDER_GRID_LINE} 0 1px, transparent 1px ${cell}px)`,
      }}
    />
  );
}
```

### `BuilderRow` + `RowGutter`

```tsx
export function BuilderRow({ row, blocks, sizes, docs, ghost, onRemoveBlock }: BuilderRowProps) {
  // `owns`: a block wins the collision over the row behind it, so the row claims its own blocks
  // to stay highlighted while the pointer is on one of them.
  const dropZone = useDropZone({
    id: rowDropId(row),
    owns: (overId) => blocks.some((block) => block.id === overId),
  });

  return (
    <SortableContext id={rowDropId(row)} items={blocks.map((block) => block.id)} strategy={horizontalListSortingStrategy}>
      {/* items-start: a short block sits at the row's top edge, exactly where packSheet puts it.
          No gap, no padding, no rounding — every one of those would be a gap the export doesn't have. */}
      <div ref={dropZone.ref} data-testid={`builder-row-${row}`} className={cn("relative flex items-start", dropZone.dropClass)}>
        {blocks.map((block) =>
          block.id === ghost?.block.id ? (
            <GhostBlock key={block.id} size={ghost.size} thumbnail={ghost.thumbnail} />
          ) : (
            <BuilderBlock
              key={block.id}
              block={block}
              size={sizes.get(block.spriteId)}
              doc={docs.get(block.spriteId)}
              onRemove={() => onRemoveBlock(block.id)}
            />
          ),
        )}
      </div>
    </SortableContext>
  );
}

export function RowGutter({ row }: { row: number }) {
  const dropZone = useDropZone({ id: gutterDropId(row) });

  return (
    // h-0: a gutter must not take layout height, or the rows it separates would show a gap the
    // exported sheet does not have. Its hit area is an absolutely positioned strip straddling the
    // boundary, so it claims the few px either side of it — which is the intent: right at a
    // boundary you mean "new row", not "join the row above".
    <div className="relative z-10 h-0">
      <div ref={dropZone.ref} className="absolute inset-x-0" style={{ top: -ROW_GUTTER_PX / 2, height: ROW_GUTTER_PX }} />
      {dropZone.isOver && <div aria-hidden className="absolute inset-x-0 -top-px h-0.5 rounded-full bg-primary" />}
    </div>
  );
}

/** The always-available next row — and, when the sheet is empty, its whole empty state. */
function TrailingRow({ row, isEmpty }: { row: number; isEmpty: boolean }) {
  const dropZone = useDropZone({ id: rowDropId(row) });

  return (
    <div
      ref={dropZone.ref}
      data-testid="builder-trailing-row"
      className={cn(
        "flex min-h-24 flex-1 items-center justify-center rounded-lg border border-dashed border-border",
        dropZone.dropClass,
      )}
    >
      {isEmpty && <p className="text-xs text-muted-foreground">Drag sprites here to build the sheet.</p>}
    </div>
  );
}
```

### `BuilderBlock` — sortable, in flow, zoom-sized

```tsx
export function BuilderBlock({ block, size, doc, onRemove }: BuilderBlockProps) {
  const zoom = useBuilderViewStore((state) => state.zoom);
  const { dragProps, dragClass } = useSortableItem(block.id, {
    type: "block",
    blockId: block.id,
  } satisfies DragData);

  const footprint = size ?? { w: 16, h: 16 };

  return (
    <div
      {...dragProps}
      // The sortable's own transform must survive alongside the zoom sizing, hence the merge.
      style={{ ...dragProps.style, width: footprint.w * zoom, height: footprint.h * zoom }}
      aria-label={doc?.name ?? "Missing sprite"}
      title={doc?.name}
      className={cn(
        // ring-inset, and no rounding: a ring that straddled the edge, or a rounded corner, would
        // read as a gap between two blocks that are in fact flush.
        "group relative shrink-0 bg-checker-a ring-1 ring-inset ring-border",
        dragClass,
        // shrink-0 keeps a long row overflowing (and scrolling) instead of squashing its blocks,
        // which would put the screen and the export out of step.
      )}
    >
      <SpriteStrip doc={doc} />

      {/* The name used to hang below the block; in a gapless sheet that would land on the next
          row, so it becomes a hover caption inside the block instead. */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 hidden truncate bg-background/70 px-0.5 text-[10px] text-muted-foreground group-hover:block">
        {doc?.name}
      </span>

      <Button
        size="icon-xs"
        variant="destructive"
        className="pointer-events-none absolute top-0.5 right-0.5 z-10 group-focus-within:pointer-events-auto group-hover:pointer-events-auto"
        revealOnHover
        aria-label={`Remove ${doc?.name ?? "sprite"}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  );
}

/** A palette sprite's placeholder while it is being dragged in — a real gap, at the real size. */
function GhostBlock({ size, thumbnail }: { size: BlockSize; thumbnail: Blob | null }) {
  const zoom = useBuilderViewStore((state) => state.zoom);
  const url = useBlobUrl(thumbnail);

  return (
    <div
      aria-hidden
      className="shrink-0 bg-primary/10 opacity-70 ring-1 ring-inset ring-primary"
      style={{ width: size.w * zoom, height: size.h * zoom }}
    >
      {url && <img src={url} alt="" className="pixelated size-full object-contain" />}
    </div>
  );
}
```

`useDnd.ts` needs a two-line type change so that `style` merge type-checks:

```ts
export interface DragItem {
  dragProps: { ref: (node: HTMLElement | null) => void; style?: CSSProperties } & Record<string, unknown>;
  …
}
```

On a block small enough that the remove button overflows it (an 8×8 sprite at 1× is 8 px), the
button simply overhangs while hovered. That is accepted rather than solved: dragging the block down
to the palette dock is the primary removal gesture now, and the X is the keyboard-reachable one.

### `BuilderViewControls`

```tsx
export function BuilderViewControls({ sheet }: { sheet: Size }) {
  const zoom = useBuilderViewStore((state) => state.zoom);
  const zoomBy = useBuilderViewStore((state) => state.zoomBy);
  const fit = useBuilderViewStore((state) => state.fit);
  const gridEnabled = useBuilderViewStore((state) => state.gridEnabled);
  const toggleGrid = useBuilderViewStore((state) => state.toggleGrid);
  const gridCell = useBuilderViewStore((state) => state.gridCell);
  const setGridCell = useBuilderViewStore((state) => state.setGridCell);

  return (
    <div className="flex items-center gap-0.5">
      <TooltipButton label="Zoom out" onClick={() => zoomBy(-1)} disabled={zoom === BUILDER_ZOOM_LEVELS[0]}>
        <ZoomOut />
      </TooltipButton>

      {/* The readout the brief asks for, right between the two buttons that change it. */}
      <span className="w-8 text-center text-xs tabular-nums text-muted-foreground">{zoom}×</span>

      <TooltipButton label="Zoom in" onClick={() => zoomBy(1)} disabled={zoom === BUILDER_ZOOM_LEVELS.at(-1)}>
        <ZoomIn />
      </TooltipButton>
      <TooltipButton label="Fit to window" onClick={() => fit(sheet)}>
        <Maximize />
      </TooltipButton>

      <Popover>
        <PopoverTrigger
          render={
            <Button size="icon-sm" variant={gridEnabled ? "secondary" : "ghost"} aria-label="Grid options" aria-pressed={gridEnabled}>
              <Grid3x3 />
            </Button>
          }
        />
        <PopoverContent gap="md" align="start" className="w-56">
          <Label size="sm" weight="normal" className="justify-between">
            Show grid
            <Switch checked={gridEnabled} onCheckedChange={toggleGrid} />
          </Label>
          <Separator />
          <Label size="sm" weight="normal" gap="sm" className="flex-col items-start">
            Grid cell
            <ToggleGroup value={[String(gridCell)]} onValueChange={([value]) => value && setGridCell(Number(value))} aria-label="Grid cell size">
              {BUILDER_GRID_CELLS.map((cell) => (
                <Toggle key={cell} value={String(cell)} size="sm">
                  {cell}px
                </Toggle>
              ))}
            </ToggleGroup>
          </Label>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

### `BuilderStatusBar`

```tsx
export function BuilderStatusBar({ sheet, blockCount, rowCount }: BuilderStatusBarProps) {
  const zoom = useBuilderViewStore((state) => state.zoom);

  return (
    <Panel render={<footer />} className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
      <span className="tabular-nums">{sheet.width}×{sheet.height}</span>
      <Separator orientation="vertical" className="h-3" />
      <span className="tabular-nums">{blockCount} {blockCount === 1 ? "sprite" : "sprites"}</span>
      <Separator orientation="vertical" className="h-3" />
      <span className="tabular-nums">{rowCount} {rowCount === 1 ? "row" : "rows"}</span>
      <span className="ml-auto tabular-nums">{Math.round(zoom * 100)}%</span>
    </Panel>
  );
}
```

### `BuilderPalette` — now also a drop target

```tsx
const dropZone = useDropZone({ id: PALETTE_DROP_ID });

<Panel ref={dropZone.ref} className={cn("flex h-32 shrink-0 flex-col gap-2 p-2", dropZone.dropClass)}>
```

### The shell — `SpritesheetBuilderPage`

```tsx
const sizes = useSpriteSizes();
const docs = useDocumentCache(spriteIds);
const dnd = useBuilderDnd(spritesheet, docs, save.track);
const sheet = packSheet(dnd.blocks, sizes);

return (
  <div className="grid h-dvh grid-rows-[auto_1fr_auto_auto] gap-2 overflow-hidden bg-background p-2">
    <Panel render={<header />} className="flex min-w-0 items-center gap-2 px-2 py-1.5">
      <Button aria-label="Back to sprites" size="icon-sm" variant="ghost" className="shrink-0" … />

      {/* min-w-0 flex-1: the actual fix. An <input>'s automatic minimum size is what stopped this
          shrinking, which pushed the group below past the panel edge and into the clip. */}
      <InlineNameField label="Spritesheet name" className="min-w-0 flex-1 sm:max-w-48" … />

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <BuilderViewControls sheet={sheet} />
        <Separator orientation="vertical" className="h-5" />
        {/* aria-label, because the label below is display:none at small widths — which would
            otherwise empty the button's accessible name along with it. */}
        <Button size="sm" aria-label="Export" onClick={() => setExporting(true)}>
          <Download />
          <span className="hidden sm:inline">Export</span>
        </Button>
        <SaveStatusBadge status={save.status} />
      </div>
    </Panel>

    <DragBoard<DragData>
      collisionDetection={pointerWithin}
      animateDrop={false}
      measureAlways
      onDragStart={dnd.handleDragStart}
      onDragOver={dnd.handleDragOver}
      onDrop={dnd.handleDragEnd}
      onDragCancel={dnd.handleDragCancel}
      renderPreview={renderPreview}
    >
      <BuilderCanvas blocks={dnd.blocks} sizes={sizes} docs={docs} ghost={dnd.ghost} onRemoveBlock={dnd.removeBlock} />
      <BuilderPalette placedSpriteIds={new Set(spriteIds)} />
    </DragBoard>

    <BuilderStatusBar sheet={sheet} blockCount={dnd.blocks.length} rowCount={sheet.rows.length} />
    <BuilderExportDialog … />
  </div>
);
```

`DragBoard` renders no DOM node of its own, so `BuilderCanvas` and `BuilderPalette` are the grid's
own children — which is why the row template has four entries and the canvas is the `1fr` one.

One detail while wiring: derive `spriteIds` for the document cache from `dnd.blocks`, not from
`spritesheet.blocks`, so a freshly dropped sprite starts loading its pixels on the optimistic render
rather than a few ticks later. Its *size* is already right either way, because that comes from
`useSpriteSizes`.

---

## 14.8 Export and metadata

No API change: `exportBuilderSheet(blocks, docs, options)` keeps its signature, and the emitted
metadata keeps its shape. Two differences worth knowing:

- Blocks are emitted in row-major order (`packSheet`'s order), not record order.
- A row whose blocks differ in height leaves transparent space under the shorter ones — a row is as
  tall as its tallest block, exactly as the flex row is on screen. That is the honest reading of "no
  row gap"; tighter packing would mean reflowing blocks out of the row the user put them in.

---

## 14.9 Tests

### Unit

`tests/unit/lib/sheetRows.test.ts` (new)

```ts
const blocks = (spec: [string, number][]) => spec.map(([id, row]) => ({ id, spriteId: `s-${id}`, row }));

it("collapses an emptied row and pulls the rows below it up", () => {
  const next = dropBlock(blocks([["a", 0], ["b", 1], ["c", 2]]), "b");
  expect(next.map((block) => [block.id, block.row])).toEqual([["a", 0], ["c", 1]]);
});

it("never leaves a gap when a block is dropped into a row beyond the last one", () => {
  const next = placeBlock(blocks([["a", 0]]), { id: "b", spriteId: "s-b", row: 0 }, { row: 5, index: 0 });
  expect(next.map((block) => block.row)).toEqual([0, 1]);
});

it("moves the only block of row 0 into the trailing row without leaving row 0 blank", () => {
  const [block] = blocks([["a", 0]]);
  expect(placeBlock([block], block, { row: 1, index: 0 })).toEqual([{ ...block, row: 0 }]);
});

it("inserts a row in the middle, pushing the rows below down", () => {
  const next = insertRow(blocks([["a", 0], ["b", 1]]), { id: "c", spriteId: "s-c", row: 0 }, 1);
  expect(next.map((block) => [block.id, block.row])).toEqual([["a", 0], ["c", 1], ["b", 2]]);
});

it("reorders within a row using arrayMove semantics", () => {
  const list = blocks([["a", 0], ["b", 0], ["c", 0]]);
  // Dropping A onto B (index 1) must land A after B.
  expect(placeBlock(list, list[0], { row: 0, index: 1 }).map((block) => block.id)).toEqual(["b", "a", "c"]);
});
```

`tests/unit/export/spritesheetBuilderLayout.test.ts` (rewritten — the `findFreePosition` cases go)

```ts
const sizes = new Map([
  ["wide", { w: 32, h: 8 }],
  ["tall", { w: 8, h: 16 }],
  ["small", { w: 8, h: 8 }],
]);

it("lays a row out left to right with no column gap", () => {
  const sheet = packSheet(
    [{ id: "a", spriteId: "small", row: 0 }, { id: "b", spriteId: "wide", row: 0 }],
    sizes,
  );
  expect(sheet.blocks.map((block) => block.x)).toEqual([0, 8]);
  expect(sheet.width).toBe(40);
});

it("starts a row directly below the tallest block of the row above", () => {
  const sheet = packSheet(
    [{ id: "a", spriteId: "tall", row: 0 }, { id: "b", spriteId: "small", row: 0 }, { id: "c", spriteId: "small", row: 1 }],
    sizes,
  );
  expect(sheet.blocks.at(-1)).toMatchObject({ id: "c", x: 0, y: 16 });
  expect(sheet.height).toBe(24);
});

it("skips a sprite whose size is not known yet without shifting the rest", () => {
  const sheet = packSheet(
    [{ id: "a", spriteId: "missing", row: 0 }, { id: "b", spriteId: "small", row: 0 }],
    sizes,
  );
  expect(sheet.blocks).toEqual([{ id: "b", spriteId: "small", row: 0, x: 0, y: 0, w: 8, h: 8 }]);
});
```

### Browser — the invariant

This is the test that keeps the export honest, and it belongs in
`tests/browser/flows/spritesheet-drag.browser.test.tsx`:

```tsx
test("what the sheet shows is what packSheet exports", async () => {
  // Deliberately mixed sizes and frame counts, in two rows.
  …
  const canvas = screen.getByTestId("builder-canvas").element();
  const origin = canvas.getBoundingClientRect();
  const sheet = packSheet(await blocksOf(sheetId), sizesFromRecords(await db.sprites.toArray()));
  const zoom = useBuilderViewStore.getState().zoom;

  for (const packed of sheet.blocks) {
    const rect = canvas.querySelector(`[data-block-id="${packed.id}"]`)!.getBoundingClientRect();
    expect(Math.round(rect.left - origin.left)).toBe(packed.x * zoom);
    expect(Math.round(rect.top - origin.top)).toBe(packed.y * zoom);
    expect(Math.round(rect.width)).toBe(packed.w * zoom);
  }
});
```

(`BuilderBlock` gains `data-block-id={block.id}` for this.)

### Browser — behaviour

`spritesheet-drag.browser.test.tsx`, rewritten around `dragElementOnto` and row targets:

| Test | Asserts |
| --- | --- |
| Palette sprite dropped on the trailing row | one block, `row: 0` |
| Second sprite dropped on row 0, right of the first | `row: 0`, and it is second in the array |
| Sprite dropped on row 0 **left** of the first block | it becomes first in the array |
| Sprite dropped on the gutter above row 0 | new row 0, the old row 0 becomes row 1 |
| Block dragged onto its neighbour in the same row | the two swap, one write, ids preserved |
| Block dragged onto a block in another row | it lands in that row, its old row collapses if emptied |
| Block dragged onto the palette dock | removed from the sheet, back in the palette |
| Block dropped nowhere (over the header) | nothing changes |
| Removing the middle row's last block | the row below moves up (`row` decreases by 1) |

The two "dropping onto an occupied cell is rejected" / "a drop lands on the grid, not between
cells" tests are deleted: neither behaviour exists any more.

`spritesheet-builder.browser.test.tsx` — fixtures become `{ id, spriteId, row }`; add two cases:

- The header keeps Export reachable at a narrow width: set the viewport to 640×720 and assert
  `getByRole("button", { name: "Export" })` is visible (the regression this phase fixes).
- Zoom controls change the readout and the rendered block size: click "Zoom in", assert the readout
  reads `6×` and a block's `getBoundingClientRect().width` grew by exactly 6/4.

`dnd-visuals.browser.test.tsx` — one new screenshot case, the direct analogue of the colors one:
hold a palette sprite over the middle of a populated row and assert the ghost has opened a gap
(`toMatchScreenshot`), then release and assert the order.

### Screenshots

No test uses `toMatchScreenshot`; the `__screenshots__` folders are Vitest's automatic captures of
*failing* tests, so there are no baselines to regenerate.

---

## 14.10 Order of work

Each step leaves the suite green before the next begins.

1. **Constants, schema, row algebra, packer** + their unit tests. No UI yet; `npm run test:unit`
   is the gate. The app won't compile until step 2 touches the components, so expect type errors
   in `builder/*` throughout this step — that list is the checklist for step 2.
2. **Export, thumbnail, dnd hook**: `spritesheetBuilder.ts`, `thumbnails.ts`, `useBuilderDnd.ts`.
   `tests/browser/export/spritesheetBuilder.browser.test.tsx` goes green here.
3. **View state**: store, `useBuilderViewport`, `useSpriteSizes`, `useOptimisticOrder`.
4. **Components**: `DragBoard` + `useDnd` type change first (they're shared), then canvas, row,
   gutter, block, view controls, status bar, palette drop zone, shell.
5. **Tests and baselines**: rewrite the five fixture/assertion files, add the invariant test and the
   dnd-visuals case, regenerate screenshots.

A good place to stop and look at it: end of step 4. Steps 1–3 are invisible.

---

## 14.11 Known limitations

- **Keyboard dragging is partial.** The keyboard sensor sorts a focused block within its row, but
  moving it to another row, a gutter or the dock needs a pointer. Removal stays fully
  keyboard-driven through the ✕ button. Worth a follow-up (arrow-key row moves on a focused block).
- **No undo.** The composer has no history stack, so a drag-out removal is undone by dragging the
  sprite back from the palette. Unchanged by this phase, but the new gesture makes it easier to hit.
- **Mixed-height rows waste space.** By design — see §14.8.
- **Gutters take the edge of every row.** A gutter's 8px strip straddles each boundary at the
  highest collision priority, so the top and bottom 4px of a row mean "new row", not "join it". A
  deliberate trade — the alternative, gutters that take layout height, would put gaps in the sheet.
- **Two drops in quick succession can flash the first layout.** `useOptimisticOrder` drops its
  guess on the next live read, and each drop writes twice (blocks, then thumbnail) — so the read
  after drop 1's write can briefly replace drop 2's guess. Only visible at sub-100ms drop pace.
- **A failed palette write leaves the guessed order on screen.** `updatePalette` is fire-and-forget
  in `PalettePanel`, as it was before this phase; the composer's writes report failure through the
  save badge.
- **A block reads "Missing sprite" to assistive tech until its document loads**, although the
  sprite record (and its name) is available sooner.
- **Over a gutter, a dragged block stays where it was last shown** while the gutter's line says
  "new row" — the drop follows the line. Moving the block itself mid-drag would unmount the drag
  source; showing a phantom row instead is a possible follow-up.
- **Legacy blocks** (`x`/`y`, no `row`) from a pre-phase-14 database or backup are read as row 0 —
  `toRows` treats any non-integer row that way — rather than migrated.

---

## Done when

- [ ] `SpritesheetBlockRecord` has no `x`/`y`, and nothing in `src/` computes a block coordinate
      outside `packSheet`.
- [ ] Dropping a sprite anywhere along a row's band appends it to that row, flush against its
      neighbour — no column gap, at any zoom.
- [ ] Dragging a block over its neighbours shifts them live, and the order that lands is the order
      that was previewed.
- [ ] Dropping on a gutter inserts a row; emptying a row collapses it; the sheet never opens with a
      blank first row or a gap between rows.
- [ ] The sheet fills the panel, scrolls at high zoom, and the empty area below it accepts a drop.
- [ ] `−`/`+` step the ladder, the level is readable in the header (`4×`) and the footer (`400%`),
      ⌘/ctrl+wheel zooms, plain wheel scrolls, and fit picks the largest level that fits.
- [ ] The grid is on when a sheet is first opened, hides itself below 6 px per cell, and its cell
      size is switchable.
- [ ] At 640px wide, the Export button is visible and clickable.
- [ ] A block dragged onto the palette dock is removed and immediately reappears there.
- [ ] `npm run test:all` passes, including the DOM-versus-`packSheet` invariant test.
