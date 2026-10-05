# Tasks: Trim over-engineering

Spec: [issue #49](https://github.com/sabeq96/easy-sprite/issues/49)

One PR on a dedicated branch, one commit per task 1–5. Every commit passes `npm test` and `npm run lint`.

## 1. Dependencies
Branch created. `@fontsource-variable/geist` and `next-themes` are gone; the toast in `src/components/ui/sonner.tsx` reads the theme from `useThemeStore`, so toasts follow the app theme instead of the system.
- [x] Both packages removed from `package.json` and the lockfile
- [x] New browser test next to the existing component tests: theme store set to dark → shown toast renders dark
- [x] Unit tests and lint pass; committed

## 2. Reuse
Duplicates collapse onto the existing helper:
- The Lasso joins samples with the Pencil's line routine (`traceLine` in `src/tools/select/selection.ts` deleted).
- History uses `rectClamp` (its `clampRect` deleted) and keys per-Cel records without string build/parse.
- Split into frames uses `cropRegion` and `computeSplitGrid` (`cropPixels` and its own column/row arithmetic deleted).
- `snapToLadder` and its test are deleted; `snapTileSize` stays.
- `useDocumentRevision` is generic over both document kinds; `useRevision` in `useSpritesheetSnapshot.ts` is deleted.
- Hand-written `Math.max(0, Math.min(...))` clamps use `clamp`.

Checks:
- [x] Lasso expectations in the select tool unit suite re-derived (expected masks only)
- [x] New unit test: a Lasso along a path selects edge pixels identical to a Pencil Stroke along the same path
- [x] Sprite document, history, grid and sprite repository suites pass unchanged
- [x] Unit tests and lint pass; committed

Notes:
- Kept db's `cropPixels`: the lint layering rule bars `src/db/**` from importing `@/core/buffer` (user's call). Split into frames still uses `computeSplitGrid`.
- The existing Lasso expectations already held under the Pencil tie-break; none needed re-deriving.

## 3. Dead code
Every export the spec lists as unused or test-only is deleted, along with tests that exercise only those exports. This includes `rgbaToCss`, `toHexList`, `EMPTY_RECT`, `MIN_CHECKER_SIZE`, list-all-settings, `NumberField.tsx`, `clearRegion`, `isInsideSprite`, `pickColor`, `removeCelsForFrame`, `findCel`, `placeBlock`, `insertRow` and `RowTarget`, `bindingSignature`, the rect contains/intersects predicates, and the Keyboard shortcuts tool-list alias.
- [x] `grep` finds no remaining references to the deleted names
- [x] Unit tests and lint pass; committed

Notes:
- `bindingSignature` was also used by the two duplicate-chord tests (`modules.test.ts`, `useBuilderCommands.browser.test.tsx`); they now use `formatBinding`, which the app runs.
- Tests that used a deleted helper only as a step keep their subject: the crop round-trip clears with `buffer.fill(0)`, the flush-copy test reads via `db.cels.get(celKey(...))`.
- `src/editor/toolbox/contributed.ts` had its own `TOOLS_WITH_COMMANDS` alias; removed after review.

## 4. Shrinks
Zoom step-down uses `findLast` instead of copying and reversing the ladder. The quota guard keeps one name check. The clipboard entry and the Floating selection drop their `rect` field, and readers use the selection shape's bounds instead.
- [x] Viewport and Builder view store suites pass unchanged
- [x] Unit tests and lint pass; committed

Notes:
- `findLast` replaces the copy-and-reverse in all three zoom ladders: `viewport.ts`, `useBuilderViewStore.ts`, `stepLadder`. The tile-preset search in `lib/tiles.ts` is not a zoom ladder and stays.
- Quota guard: one name check with no `instanceof`, so a raw `DOMException` is caught in Chromium and jsdom alike (checked with throwaway tests).

## 5. Restructures
- Palette: sortable and plain swatches share one swatch body. The plain swatch has no remove handler.
- Builder drag model: one helper builds the committed-plus-ghost block lookup, used at all three sites. Draft rendering uses `draftToRows`.
- Sprite document: private helpers remove and restore Cels for both Layers and Frames. Restored Cels are marked dirty.
- Backup: one encode and one decode helper for thumbnails. The import-writing helper is inlined into import, and the one-transaction comment stays. The file format is unchanged.

Checks:
- [x] Sprite document and backup suites pass unchanged (round trips, merge and replace)
- [x] Unit tests and lint pass; committed

## 6. Branch verification and PR
The branch is verified as a whole and opened as a PR.
- [x] `npm run build` passes
- [x] `npm run test:all` passes (browser suites: select/move, Palette, drag-and-drop visuals, spritesheet drag, Builder)
- [x] `git diff --stat main -- src` shows roughly −229 lines
- [x] PR opened against `main` (#53)

Notes:
- Net −189 lines in `src/` (195+, 384−), not ~−229: `cropPixels` stays in db (see task 2), and the shared helpers add some back. Tests: net −57.
- 93 files / 667 tests pass; the build's only warning is the existing chunk-size notice.
