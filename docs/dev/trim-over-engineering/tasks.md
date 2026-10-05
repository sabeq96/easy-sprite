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
- [ ] Lasso expectations in the select tool unit suite re-derived (expected masks only)
- [ ] New unit test: a Lasso along a path selects edge pixels identical to a Pencil Stroke along the same path
- [ ] Sprite document, history, grid and sprite repository suites pass unchanged
- [ ] Unit tests and lint pass; committed

## 3. Dead code
Every export the spec lists as unused or test-only is deleted, along with tests that exercise only those exports. This includes `rgbaToCss`, `toHexList`, `EMPTY_RECT`, `MIN_CHECKER_SIZE`, list-all-settings, `NumberField.tsx`, `clearRegion`, `isInsideSprite`, `pickColor`, `removeCelsForFrame`, `findCel`, `placeBlock`, `insertRow` and `RowTarget`, `bindingSignature`, the rect contains/intersects predicates, and the Keyboard shortcuts tool-list alias.
- [ ] `grep` finds no remaining references to the deleted names
- [ ] Unit tests and lint pass; committed

## 4. Shrinks
Zoom step-down uses `findLast` instead of copying and reversing the ladder. The quota guard keeps one name check. The clipboard entry and the Floating selection drop their `rect` field, and readers use the selection shape's bounds instead.
- [ ] Viewport and Builder view store suites pass unchanged
- [ ] Unit tests and lint pass; committed

## 5. Restructures
- Palette: sortable and plain swatches share one swatch body. The plain swatch has no remove handler.
- Builder drag model: one helper builds the committed-plus-ghost block lookup, used at all three sites. Draft rendering uses `draftToRows`.
- Sprite document: private helpers remove and restore Cels for both Layers and Frames. Restored Cels are marked dirty.
- Backup: one encode and one decode helper for thumbnails. The import-writing helper is inlined into import, and the one-transaction comment stays. The file format is unchanged.

Checks:
- [ ] Sprite document and backup suites pass unchanged (round trips, merge and replace)
- [ ] Unit tests and lint pass; committed

## 6. Branch verification and PR
The branch is verified as a whole and opened as a PR.
- [ ] `npm run build` passes
- [ ] `npm run test:all` passes (browser suites: select/move, Palette, drag-and-drop visuals, spritesheet drag, Builder)
- [ ] `git diff --stat main -- src` shows roughly −229 lines
- [ ] PR opened against `main`
