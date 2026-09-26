# Tile size & shared view controls

Status: done
Date: 2026-09-26

## Goal
Both editors share one zoom control (`− 8× +` plus fit) and one grid/chess popover, and neither shows zoom in
its status bar. Sprites and sheets carry a preset **tile size**. Sprites are created and resized as
tile × cols × rows (resize keeps its anchor). Opening a sprite or sheet sets grid = tile and chess = 1px.
The sheet editor gains a chess pattern behind its blocks, the editor's zoom/fit/grid/help/back keyboard
shortcuts, and a shortcut sheet. Zoom ladders grow to sprite 0.5–48× and sheet 1–12×.

## Non-goals
- No custom tile sizes, and no free width/height entry in New sprite or Resize canvas.
- Split frames dialog unchanged (keeps its own presets and fields).
- Tile size does not constrain sheet packing or snapping. It only drives grid/chess defaults.
- Grid and chess edits are not persisted. They reset on every open.
- The sheet editor gets no edit/undo shortcuts (it has no undo today). Only view and app commands.
- No change to which keys the sprite editor binds.
- The chess pattern is not added to the sheet palette tiles or the drag preview.
- No change to the sheet editor's wheel/scroll behaviour or to the sprite editor's pan.
- No UI to change a sheet's tile size after creation.

## Decisions
| # | Decision | Why | Rejected alternative |
|---|----------|-----|----------------------|
| 1 | Presets `8, 16, 24, 32, 48, 64`; `MAX_GRID_SIZE` and `MAX_CHECKER_SIZE` raised to 64 | Standard pixel-art tiles; the grid can always equal the tile | 128 (gives at most 4×4 under the 512 cap) |
| 2 | `tileSize?: number` stored on `SpriteRecord` and `SpritesheetRecord`, with no Dexie version bump | Not indexed, and older records simply lack it | Deriving it every time (nothing to derive for a sheet) |
| 3 | Missing `tileSize` → `inferTileSize(w,h)`: the largest preset dividing both, else `undefined`. The grid then falls back to the sprite divisor closest to 16. Sheets fall back to 16 | Covers old sprites, PNG imports and splits without a migration | Migration that stamps every record |
| 4 | PNG import stores `inferTileSize` | So imports get a sensible grid too | Leaving it unset |
| 5 | Grid/chess reset on open (and when a resize changes the tile). Popover edits are session-only | Your call | Saving per document |
| 6 | Resize: tile + cols + rows + anchor. Changing the tile **recomputes cols/rows** as `ceil(current px / tile)`, clamped | Changing only the tile keeps the canvas as close to its size as possible instead of cropping | Keeping cols/rows (32px@16 → 8 tile would crop to 16px) |
| 7 | `tileSize` lives on `SpriteDocument`; `resizeCanvasCommand` sets and undoes it; a tile-only change is its own undoable command | Undo must restore both the grid and the tile | Tile outside the document (not undoable, and autosave would need a separate path) |
| 8 | Sheet grid/chess options `[1,2,4,8,16,32,64] ∪ {tile}` | A sheet has no fixed size to divide | Same divisor logic as sprites |
| 9 | Chess behind each sheet block: CSS conic gradient, tile = chess × zoom | Your call. Matches `CheckerboardLayer` | Whole-sheet background |
| 10 | Shared components bind to **commands**: `ZoomControls` renders `CommandButton`s for `view.zoomOut/zoomIn/fit`, and each editor provides its own registry | Tooltips, keys and disabled state come from one place in both editors | Callback props plus a separate shortcuts prop |
| 11 | Ladders: sprite `[0.5,1,2,3,4,6,8,12,16,24,32,48]`, sheet `[1,2,3,4,6,8,12]` | You asked for 0.5–42 and 1–12. **48 instead of 42** keeps the ladder's ×1.5 steps (24→32→48) | A literal 42 |
| 12 | The sheet gets `useBuilderCommands`, a registry with `view.zoomIn/zoomOut/fit/toggleGrid` and `app.shortcutHelp/backToLibrary`, using the existing `APP_SHORTCUTS` keys (`-`/`_`, `+`/`=`, `0`, ⌘G, `?`, ⇧Esc) | Same keys in both editors, from one keymap | A separate builder keymap |
| 13 | `useShortcuts` becomes editor-agnostic; the held-tool (Alt → picker) handling moves to a new editor-only `useHeldToolKeys` | Otherwise the sheet would push temporary tools into the editor store (a leak) | A flag argument on `useShortcuts` |
| 14 | Shortcut sheet split: `common/ShortcutHelpDialog` (command groups plus hint sections, plus optional leading sections); the editor wrapper adds its tool sections; the sheet passes `BUILDER_VIEW_HINTS` (⌘/Ctrl+Wheel zoom) | One dialog, and each editor declares only what it owns | A second, copied dialog |
| 15 | The grid popover trigger takes `enabled` from props and its tooltip keys from `commandKeys("view.toggleGrid")`. It is not a `CommandButton`, because `CommandButton` reads `isActive` through the editor store | Avoids tying the sheet to the editor store | Generalising `CommandButton`'s active subscription |

## Interfaces
```ts
// constants/canvas.ts
export const TILE_SIZE_PRESETS = [8, 16, 24, 32, 48, 64] as const;
export const DEFAULT_TILE_SIZE = 16;
export const DEFAULT_TILE_COUNT = 2;          // new sprite 16 × 2×2 = 32×32, same as today
export const DEFAULT_CHECKER_SIZE = 1;        // was 8
// DEFAULT_CANVAS_SIZE removed; CANVAS_SIZE_PRESETS kept for SplitFramesDialog only

// editor/grid.ts (additions)
export function maxTileCount(tile: number): number;                   // floor(MAX_CANVAS_SIZE / tile)
export function inferTileSize(width: number, height: number): number | undefined;
export function defaultGridSize(tile: number | undefined, width: number, height: number): number;
export const SHEET_TILE_OPTIONS: readonly number[];                   // [1,2,4,8,16,32,64]

// lib/format.ts
export function formatZoom(scale: number): string;                    // 0.5 → "0.5×", 8 → "8×"

// components/common/ZoomControls.tsx — needs a CommandsProvider with view.zoomOut/zoomIn/fit
interface ZoomControlsProps { zoom: number }                         // renders  [−] 8× [+] [fit]
// components/common/GridOptionsPopover.tsx
interface GridOptionsPopoverProps {
  enabled: boolean; onEnabledChange: () => void;
  gridSize: number; gridOptions: number[]; onGridSizeChange: (n: number) => void;
  checkerSize: number; checkerOptions: number[]; onCheckerSizeChange: (n: number) => void;
}
// components/common/TileSizePicker.tsx — toggle group over TILE_SIZE_PRESETS
// components/common/TileCountFields.tsx — cols × rows inputs (1..maxTileCount), shows "= W×H px"

// shortcuts
useShortcuts(commands: CommandRegistry): void            // no editor-store access any more
useHeldToolKeys(): void                                  // hooks/, editor only
useBuilderCommands(sheet: Size, onHelp: () => void): CommandRegistry   // commands/
BUILDER_VIEW_HINTS: HintSection                          // in useBuilderViewport.ts
// components/common/ShortcutHelpDialog.tsx
interface ShortcutHelpDialogProps {
  commands: CommandRegistry; open: boolean; onOpenChange: (open: boolean) => void;
  description: string; hints: HintSection[];
  leadingSections?: { title: string; rows: ShortcutRow[] }[];
}
// components/editor/ShortcutHelpDialog.tsx stays as a thin wrapper that adds the tool sections

// document / records
SpriteRecord.tileSize?: number; SpritesheetRecord.tileSize?: number;
DocumentInit.tileSize?: number; SpriteDocument.tileSize: number | undefined;
SpriteDocument.resize(w, h, options, tileSize?)          // bumps "meta"
SpriteDocument.setMeta({ ..., tileSize })
resizeCanvasCommand(doc, w, h, options, tileSize?)       // tile-only change → setMeta command
CreateSpriteOptions.tileSize?; CreateSpritesheetOptions.tileSize?

// stores
viewSlice:        resetGrid(gridSize: number)   // gridSize = n, checkerSize = DEFAULT_CHECKER_SIZE
builderViewStore: gridCell → gridSize, + checkerSize, setCheckerSize, resetGrid(gridSize)
```
Layout: `ZoomControls`, `GridOptionsPopover` and the help button (keyboard icon) at the right of each
top bar, in the same order. The
`%` is removed from `EditorStatusBar` and `BuilderStatusBar`.

## Test approach
- Unit: `grid.ts` helpers (`maxTileCount`, `inferTileSize`, `defaultGridSize`), `formatZoom`, resize
  command setting and undoing `tileSize` (including tile-only), `viewSlice.resetGrid`, builder store
  `resetGrid`/`checkerSize` (update the existing `gridCell` assertions). Update the keymap test if
  the ladder is asserted anywhere.
- Browser: update `tests/browser/builder/view`, `editor/view`, and the `sprite-manager` /
  `spritesheet-builder` flows for the new dialogs and labels. Add: the New sprite flow creates
  16 × 3×2 → 48×32 with tileSize 16; opening it sets grid 16 / chess 1; the sheet zoom label reads `4×`
  and the status bar has no `%`. In the sheet, `=` zooms 4×→6×, `-` zooms back, ⌘G toggles the grid,
  and `?` opens the shortcut sheet listing those keys. The existing `useShortcuts` browser test still
  passes, including Alt → picker via `useHeldToolKeys`.
- Commands: `npm run lint && npx tsc -b && npm test && npm run test:browser`

## Done when
- [ ] Both top bars show `−  N×  +` and fit via `ZoomControls`, and neither status bar shows zoom.
- [ ] Both editors use `GridOptionsPopover` (switch, grid slider, chess slider). The sheet version has chess.
- [ ] New sprite: tile preset plus cols/rows only; the created record has `width = cols·tile` and `tileSize`.
- [ ] New sheet: tile preset; the record has `tileSize`.
- [ ] Resize canvas: tile + cols/rows + anchor. Changing the tile keeps the canvas size where possible. Undo restores size and tile.
- [ ] Opening a sprite/sheet sets grid = tile (or the fallback) and chess = 1.
- [ ] Sheet blocks show the chess pattern at chess × zoom.
- [ ] Sprite zoom steps from 32 to 48, and sheet zoom from 8 to 12; the + button disables at the top.
- [ ] In the sheet, `-`/`_`, `+`/`=`, `0`, ⌘G, `?` and ⇧Esc work, and none fire while typing in the name field.
- [ ] The sheet has a help button and `?`, both opening a shortcut list of exactly those keys plus ⌘/Ctrl+Wheel.
- [ ] `SizeFields.tsx` deleted (no users left).
- [ ] Test command above passes.

## Open risks
- At zoom 1 in the sheet editor, a 1px chess pattern is 1 screen px and will look like noise. It follows your default; the popover can raise it.
- Old sprites whose size isn't a multiple of any preset: Resize opens with `ceil` cols/rows, so hitting Resize without changes pads the canvas. The button is disabled while nothing differs from the current state, and the dialog shows the resulting px.

## Tasks
(Numbers point at the Done-when items, in order 1–12.)
- [ ] `src/constants/canvas.ts`, `src/constants/builder.ts` — presets, defaults, ladders; drop builder grid-cell constants → 3, 8
- [ ] `src/editor/grid.ts`, `src/lib/format.ts` — helpers → 1, 5, 6
- [ ] `src/db/schema.ts`, `src/db/repositories/sprites.ts`, `spritesheets.ts`, `src/services/importPng.ts`, `src/services/documentService.ts`, `src/hooks/useSpritesheetActions.ts` — tileSize through records and documents → 3, 4, 6
- [ ] `src/editor/document.ts`, `src/editor/commands/canvas.ts` — tileSize on the document, resize/undo → 5
- [ ] `src/stores/slices/viewSlice.ts`, `src/stores/useBuilderViewStore.ts` — resetGrid, checker → 6, 7
- [ ] `src/components/common/ZoomControls.tsx`, `GridOptionsPopover.tsx`, `TileSizePicker.tsx`, `TileCountFields.tsx` (new); delete `SizeFields.tsx` → 1, 2, 3, 5, 11
- [ ] `src/components/editor/ViewControls.tsx`, `EditorStatusBar.tsx`, `EditorPage.tsx` (reset + held keys), `ResizeCanvasDialog.tsx` → 1, 2, 5, 6
- [ ] `src/components/builder/BuilderViewControls.tsx`, `BuilderStatusBar.tsx`, `BuilderCanvas.tsx`, `BuilderBlock.tsx` → 1, 2, 7
- [ ] `src/components/manager/NewSpriteDialog.tsx`, `NewSpritesheetDialog.tsx` → 3, 4
- [ ] `src/hooks/useShortcuts.ts`, `src/hooks/useHeldToolKeys.ts` (new) → 9
- [ ] `src/commands/useBuilderCommands.ts` (new), `src/hooks/useBuilderViewport.ts` (hints) → 9, 10
- [ ] `src/components/common/ShortcutHelpDialog.tsx` (new, generic), `src/components/editor/ShortcutHelpDialog.tsx` (wrapper) → 10
- [ ] `src/components/builder/SpritesheetBuilderPage.tsx` — CommandsProvider, shortcuts, help button and dialog, reset on open → 6, 9, 10
- [ ] tests listed above → 12

## Drift log
- Tile helpers (`maxTileCount`, `tileCountFor`, `inferTileSize`, `sheetTileOptions`) live in `src/lib/tiles.ts`, not `editor/grid.ts`: lint forbids `db/` importing `editor/`, and the repositories need `inferTileSize`.
- Decision 10 → `ZoomControls` takes `{ zoom, levels }`: `CommandButton` reads `isEnabled` once and the React Compiler caches it, so −/+ never disabled. `levels` drives `disabled`; the commands' `isEnabled` still guards the keys.
- Split also re-derives `tileSize` with `inferTileSize(frameW, frameH)`, because the old tile rarely fits the new frame size.
- `SpriteDocument.resize` takes `tileSize` as a required argument: a default parameter swallowed `undefined`, so undo could not clear a tile the sprite never had (caught by the new unit test).
- `SHEET_TILE_OPTIONS` lives in `constants/builder.ts`, and the sprite editor's reset-on-open is its own hook, `hooks/useGridDefaults.ts` (called from `EditorPage`).
- Review fixes: `defaultGridSize` now tries `inferTileSize` before the divisor fallback (Decision 3), and Resize compares against the tile it opened with, so an untouched dialog on an old sprite stays disabled.
- Test-only: `select-move` now waits for the overlay to clear after disabling the grid. The new 16px default grid is drawn at the test's 0.5× zoom, which exposed a same-tick race.

