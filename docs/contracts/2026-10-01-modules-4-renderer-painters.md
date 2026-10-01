# Modules 4/5: the renderer draws registered painters

Status: approved (2026-10-01)
Date: 2026-10-01
Depends on: [3 settings](2026-10-01-modules-3-settings.md) merged
Series: [0 core](2026-10-01-modules-0-core-rename.md) · [1 tool folders](2026-10-01-modules-1-tool-folders.md) · [2 tool interfaces](2026-10-01-modules-2-tool-interfaces.md) · [3 settings](2026-10-01-modules-3-settings.md) · [4 painters](2026-10-01-modules-4-renderer-painters.md) · [5 host modules](2026-10-01-modules-5-host-modules.md)

## Context

Read "Why this series exists" in [stage 0](2026-10-01-modules-0-core-rename.md) first.

`src/core/renderer.ts` knows what a grid and an onion skin are:

- `RendererState` carries `gridEnabled`, `gridSize`, `onion` and `isPlaying`.
- `setState` has an invalidation branch per field.
- `drawGrid` and `renderOnion` are private methods.
- There is a separate `setToolOverlay` slot.

Every canvas addition touches the renderer, `useCanvasRenderer` and the store.

A separate "features" category for grid and onion skin was considered and rejected (see
stage 0). Grid and onion skin stay host capabilities. This stage only makes the renderer
stop knowing about them.

## Goal

- `CanvasRenderer`'s public interface becomes:
  - `setState({ viewport, frameId, isPlaying })`
  - `addPainter(painter) → remove`
  - `invalidate`, `invalidateAll`, `resize`, `dispose`

  It keeps the pipeline (channels, rAF, dpr, composite of the current frame) and draws the
  registered painters on the `onion` and `overlay` channels, in registration order.
- Grid and onion drawing become pure functions in `src/core/painters/` (`drawGrid`,
  `drawOnion`). The host registers them as painters with getters over its own state.
- A tool's overlay (`host.canvas.setOverlay`) is a painter on the `overlay` channel. The
  `setToolOverlay` slot is deleted.
- No visible or behavioural change.

## Non-goals

- Grid and onion state stay in `viewSlice` (stage 5 moves them into the `view` and `animation` module stores).
- No change to the chessboard (CSS, stays in `EditorCanvas`), to the builder, or to `ToolHost`'s interface.
- No new channel. `main` stays built in.

## Decisions

| # | Decision | Why | Rejected alternative |
|---|----------|-----|----------------------|
| 1 | **Settled by the maintainer.** No "features" category. Grid and onion skin are host capabilities, and only the renderer is deepened | A third category had no clear rule. The renderer is where the real gain is | `src/features/` with a feature registry, slots and sessions (rejected 2026-10-01) |
| 2 | `Painter = { channel: "onion" \| "overlay"; paint(p: PaintContext): void }`. `PaintContext` carries `ctx`, `viewport`, `doc`, `frameId`, `isPlaying` and `dpr`. Within a channel, painters draw in registration order | The smallest interface that covers grid, onion, selection and brush preview | A z-index field (nothing needs it) |
| 3 | The host registers the grid and onion painters when it creates the renderer (`useCanvasRenderer`), **before** any tool attaches. Tool overlays are added and removed per activation, so they always draw above the grid | Keeps today's stacking without an ordering field | A per-painter `order` |
| 4 | `drawGrid(p, size)` and `drawOnion(p, opts, scratch)` live in `src/core/painters/` as pure functions. They are moved verbatim from the private methods | Rendering primitives belong in the core. The host decides when they run. This avoids a second move in stage 5 | Painters living in hooks |
| 5 | `presentSprite(ctx, source, viewport, doc, alpha)`, the scaled `drawImage` of the main channel, is exported from `core/composite.ts` and reused by `drawOnion` | One copy of the scaling math | Duplicating it |
| 6 | `useCanvasRenderer` invalidates the `overlay` channel when grid state changes and the `onion` channel when onion state changes, through a store subscription instead of `setState` fields | The renderer stops carrying feature state | Keeping `RendererState` fields |
| 7 | `OverlayPaint` in `framework/host.ts` becomes `(p: PaintContext) => void`. Tool overlays (select, brush preview) take the context object | One painter signature everywhere | Two signatures |
| 8 | Removed:<br>• `RendererState.gridEnabled`, `gridSize` and `onion`<br>• `drawGrid`, `renderOnion` and `onionScratch` as methods<br>• `setToolOverlay` and `toolPainter`<br>• `OnionSettings` in the renderer (`OnionConfig` stays in the store) | Replaced | Shims |

## Interfaces

```ts
// src/core/renderer.ts
export type PaintChannel = "onion" | "overlay";
export interface PaintContext {
  ctx: CanvasRenderingContext2D;  // cleared, in CSS pixels, smoothing off
  viewport: Viewport;
  doc: SpriteDocument;
  frameId: string;
  isPlaying: boolean;
  dpr: number;
}
export interface Painter { channel: PaintChannel; paint(p: PaintContext): void }
export interface RendererState { viewport: Viewport; frameId: string; isPlaying: boolean }
export class CanvasRenderer {
  setState(patch: Partial<RendererState>): void;
  /** Drawn on its channel after every painter added before it. Returns the remover. */
  addPainter(painter: Painter): () => void;
  invalidate(...channels: ("main" | PaintChannel)[]): void;
  invalidateAll(): void;
  resize(cssWidth: number, cssHeight: number, dpr?: number): void;
  dispose(): void;
}

// src/core/painters/grid.ts
export function drawGrid(p: PaintContext, size: number): void;
// src/core/painters/onion.ts
export function drawOnion(p: PaintContext, opts: { direction: OnionDirection; opacity: number }, scratch: OffscreenCanvas): void;
// src/core/composite.ts
export function presentSprite(ctx: CanvasRenderingContext2D, source: CanvasImageSource, viewport: Viewport, doc: SpriteDocument, alpha: number): void;
```

Host registration (sketch, in `useCanvasRenderer` right after `new CanvasRenderer`):

```ts
const scratch = new OffscreenCanvas(1, 1);
instance.addPainter({ channel: "overlay", paint: (p) => {
  const { gridEnabled, gridSize } = useEditorStore.getState();
  if (gridEnabled) drawGrid(p, gridSize);
} });
instance.addPainter({ channel: "onion", paint: (p) => {
  const { onion } = useEditorStore.getState();
  if (onion.enabled && !p.isPlaying) drawOnion(p, onion, scratch);
} });
```

## Files

- `src/core/renderer.ts`: painters and the trimmed state. Serves 2, 8.
- `src/core/painters/grid.ts` and `src/core/painters/onion.ts`: new, moved code. `src/core/composite.ts`: `presentSprite`. Serves 4, 5.
- `src/hooks/useCanvasRenderer.ts`: registers the painters, subscribes for invalidation, and pushes only viewport, frame and playing. Serves 3, 6.
- `src/hooks/toolHost/createToolHost.ts`: `canvas.setOverlay` via `addPainter` (remove on replace and on deactivate). `src/framework/host.ts`: `OverlayPaint`. Serves 7.
- `src/tools/select/overlay.ts` and `src/tools/shared/brushCursor.ts`: paint with `PaintContext`. Serves 7.
- `docs/architecture.md` §4: the overlay channel becomes "registered painters in order: grid, then the active tool's overlay". The onion row becomes "the onion painter".

## Test plan

- New `tests/unit/core/painters.test.ts`, using a recording 2D-context fake:
  - `drawGrid` draws nothing below `GRID_MIN_SCALE`, and draws (w/size + 1) + (h/size + 1) lines otherwise.
  - `drawOnion` draws nothing at the first frame with "before".
- Browser:
  - The existing grid, onion and view suites stay green unchanged (grep `grid`, `onion` under `tests/browser`).
  - New: "the selection fill draws above the grid lines" (pins Decision 3).

Command: `npm run lint && npm run build && npm run test:coverage`

## Done when

- [x] 1. `CanvasRenderer`'s public members are exactly `setState`, `addPainter`, `invalidate`, `invalidateAll`, `resize` and `dispose`, and `RendererState` is `{ viewport, frameId, isPlaying }`.
- [x] 2. `grep -n "grid\|Grid\|onion\|Onion" src/core/renderer.ts | grep -v "\"onion\""` is empty: the renderer has no grid or onion-skin logic, and only the approved channel name `"onion"` remains (wording fixed by the maintainer's session).
- [x] 3. Grid, onion (before/after, opacity, hidden during playback), selection and brush preview look exactly as before.
- [x] 4. The command above passes.

## Open risks

- Registration order is the stacking order. Pin it with the new browser test, and leave a comment where the host registers its painters.

## Open questions for the maintainer

None.

## Drift log

- **2026-10-01, Done-when 2 is not literally empty: the channel is named `onion` (open).**
  Decision 2 and the Interfaces fix `PaintChannel = "onion" | "overlay"`, so
  `grep -n "grid\|Grid\|onion\|Onion" src/core/renderer.ts` lists eight lines, every one the
  channel name (`PaintChannel`, the `dirty` set, the `invalidate` calls, `render`). No `grid`,
  `Grid` or `Onion` remains, and nothing in the renderer knows what an onion skin is: no
  direction, opacity or enabled flag, no neighbouring frame, no scratch canvas. Left unticked:
  making the grep empty means renaming the channel (and `RendererTargets.onion`), which changes
  the approved interface. Left to the maintainer.
- **2026-10-01, tools get `ToolPaintContext = Omit<PaintContext, "doc">` (stage 2's rule that a tool never sees the document).** `OverlayPaint` takes it; the host still passes the full `PaintContext`, a structural superset. Probe: an overlay in `src/tools/select/overlay.ts` reading `p.doc.width` fails `tsc -b` with TS2339; restored from a copy.
- **2026-10-01, `RendererTargets` is `Record<Channel, HTMLCanvasElement>`.** Same three keys as
  the old interface; `resize` iterates `Object.values(targets)`.
- **2026-10-01, the tool host re-registers the overlay per `setOverlay`.** `createToolHost` keeps
  the paint (as in stage 2) and the remover of its painter. `setOverlay` and `attachRenderer`
  both remove the old painter (bound to the renderer it was added to) and add the new one when
  there are both a renderer and a paint, so a tool's overlay is always registered after the
  host's grid painter.
- **2026-10-01, `isPlaying` stays a renderer field.** It is in the agreed `RendererState`, and a
  change still invalidates `onion` inside `setState`. The store subscription (Decision 6) covers
  `gridEnabled`, `gridSize` and `onion`. The playback check moved from `renderOnion` to the host's
  onion painter (`onion.enabled && !p.isPlaying`), as in the sketch, so `drawOnion` is the
  neighbour lookup plus `presentSprite` only.
- **2026-10-01, verification beyond the suites (Done-when 3).** A throwaway browser probe, run on
  this branch and on `79adc21` in a scratch worktree, then deleted, gave identical results:
  - onion alpha at the ghosted pixel: off 0, before at 0.35 → 89, at 0.7 → 179, playing → 0,
    stopped → 179, frame 1 with before → 0, frame 1 with after → 179 at the other frame's pixel;
  - a hash of every overlay byte for: the default grid, grid size 4, grid plus a mirrored size-3
    brush preview, the preview alone, grid plus select-all, and select-all with the pointer
    outside. All six hashes match.
- **2026-10-01, tests.**
  - New `tests/unit/core/painters.test.ts`: the two planned cases, plus "nothing at the last frame
    with after" and "ghosts the neighbour once, at its opacity, and restores full alpha".
  - New browser test "the selection fill draws above the grid lines" in
    `tests/browser/tools/select.browser.test.tsx`. It reads the overlay at a device pixel the
    1.5px grid line fully covers inside a select-all, and asserts its colour is nearer the
    selection blue than the grid grey. Probe: iterating the painters in reverse in
    `renderPainters` fails it (82.5 vs 54.2); restored from a copy.
  - Probe of Decision 6: with the store subscription disabled, "onion skin ghosts the previous
    frame…" fails. No existing test fails with the grid half disabled (other invalidations
    repaint the overlay in time), so grid-toggle repaint is not pinned by a test.
  - `tests/unit/tools/brush.test.ts`: setup only. `paint` gets a `ToolPaintContext` object in place of
    `(ctx, VIEWPORT)`. Assertions unchanged.
- **2026-10-01, files outside the list.**
  - `src/constants/builder.ts`: a comment pointed at `renderer.drawGrid`; it now points at
    `core/painters/grid.ts`.
  - `docs/architecture.md`: besides the two §4 rows, a short paragraph under the §4 table on
    channels and registration order, the `core/` line of the folder map, and the `canvas` row of
    the tool-host table.
- **2026-10-01, lint.** No new rule. `core/painters/*` imports only `@/constants/*` and `@/core/*`;
  `framework/host.ts` imports `PaintContext` as a type from `@/core/renderer`, which the
  framework override allows. `npm run lint` reports only the ten pre-existing
  `only-export-components` warnings.
