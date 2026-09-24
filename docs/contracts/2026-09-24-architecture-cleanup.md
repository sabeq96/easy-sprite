# Contract — architecture cleanup (boundaries, dedup, consistency)

Status: **approved** (2026-09-24, with independent-review additions 1–5)

## Goal

Bring the code back in line with `docs/conventions.md` / `docs/architecture.md`: enforce the
component → hooks boundary with lint, remove the duplicated patterns found in review, make the
repositories uniform, and update the docs to describe the code that exists.

## Decisions

- **Boundary:** components never import `@/db/*`, `@/services/*`, `@/export/*`, `dexie`,
  `dexie-react-hooks`. They go through domain hooks in `src/hooks/` (e.g. `useSpriteActions`,
  `useSpritesheetActions`, `usePaletteActions`, `useSpritesheet`, `useBackupActions`), which own
  the repo call, the toast and the error message. Enforced by an `.oxlintrc.json` override on
  `src/components/**`.
- **Components may import `@/editor/*`** (pure command factories, the tool registry, types). The
  DAG in `architecture.md §9` is updated to say so, rather than routing 26 pure imports through
  wrappers.
- Hooks read the DB only through repositories — no raw `db` in `src/hooks/**` (lint override).
- `export/spritesheetBuilderLayout.ts` (pure) → `src/lib/`. `useBuilderDnd` → `src/hooks/`.
- One shared name(+tags) dialog replaces the 4 hand-rolled ones; drafts always reset on open.
- One `useLibrary` (filter by kind) on top of pure `src/lib/library.ts`; `useSpriteLibrary` removed.
- `useAsyncAction` hook + `errorMessage(error, fallback)` helper replace the copied
  try/toast/finally blocks. `plural()` in `src/lib/format.ts`. `DEFAULT_ITEM_NAME` constant.
- Repositories: every write goes through `withQuotaGuard`; `get*` throws `NotFoundError`
  uniformly (a `find*` variant returns `undefined` where absence is expected); barrel includes
  `spritesheets` or is deleted if still unused.
- The DAG gains `commands/`; hooks may read the document context from `app/DocumentProvider`
  (moving that context is out of scope). Every edge in the DAG is lint-enforced or removed.

### Additions from the independent doc review

1. Route-level error boundary (`errorElement`/ErrorBoundary) so a render crash is not a white screen.
2. Docs rewritten to match reality: arch §2 folder map at folder granularity, §7/§8 stale values
   (autosave 2000 ms, backup v2, browser test project), §9 DAG; conventions §10 points at
   `.oxlintrc.json` instead of pasting JSON; phase-N narrative removed from the two docs; a short
   data-access section (repo → action hook → toast/error view).
3. Small violations fixed: index keys (`ShortcutList`, `SpriteManagerPage` skeleton), prop→state
   effect in `ColorPickerPopover`, eslint-disable comments naming rules that aren't enabled,
   uncommented `useCallback` in `useSaveStatus`.
4. Size limits reworded as review heuristics.
5. "Colocate first, promote to `lib/` on second use" replaces "if it can be pure it must be in lib".

## Non-goals

- No splitting of oversized files (`PalettePanel`, `useEditorCommands`, `document.ts`, …) — C3.
- No merging of the editor and builder viewport stacks — B7.
- No visual/UX changes, no new features, no dependency upgrades or package.json moves.
- No changes to `src/components/ui/**` beyond what is needed to clear the 2 lint errors (adding a
  variant if required).
- No change to the persisted schema / DB versions.
- No jsx-a11y or React Compiler lint plugins, no feature-folder restructure (follow-ups).

## Done when

1. `npm run lint` reports **0 errors** (was 2); boundary overrides exist for `src/components/**`
   and `src/hooks/**`.
2. `grep -rE "from \"@/(db|services|export)/|dexie" src/components` returns nothing.
3. `grep -rn "from \"@/db/db\"" src/hooks` returns nothing.
4. `NewSpriteDialog`, `NewSpritesheetDialog`, `RenameDialog`, `PaletteNameDialog` share one dialog
   component; reopening after Cancel shows an empty/initial draft (covered by a test).
5. `useSpriteLibrary.ts` is gone; `src/lib/library.ts` has unit tests for filter/sort/tag counts.
6. No `error instanceof Error ? error.message :` left in `src/components`; no inline
   `=== 1 ? "x" : "xs"`; no `"Untitled"` literal outside `constants/`.
7. `npx tsc -b`, `npm test` and `npm run test:browser` pass.
8. `docs/architecture.md` folder map and DAG match the tree; conventions §10 has no pasted JSON.
9. A thrown render error inside a route shows an error view, not a blank page (browser test).
10. No `key={index}` in `src/components` outside `ui/`; no eslint-disable naming a disabled rule.

## Task list

**Batch 1 — pure foundations & repositories** (DW 5, 6)
- [x] `src/lib/format.ts` — `plural()`; `src/lib/errors.ts` — `errorMessage()`
- [x] `src/constants/names.ts` — `DEFAULT_ITEM_NAME`, used by repos/importPng/download
- [x] `src/lib/library.ts` + tests — filter/sort/tag-count for library items
- [x] move `export/spritesheetBuilderLayout.ts` → `lib/` (+ test path)
- [x] repos: palettes quota guard + `find`/`get` semantics, spritesheet `find`, drop dead barrel

**Batch 2 — hooks layer** (DW 2, 3, 5)
- [ ] `useAsyncAction`; `useLibrary({ kinds })`, delete `useSpriteLibrary`; `useSpriteSizes` via repo
- [ ] action hooks: sprites, spritesheets (+ `useSpritesheet(id)`), palettes, backup
- [ ] move `components/builder/useBuilderDnd.ts` → `hooks/`

**Batch 3 — components** (DW 1, 2, 4, 6)
- [ ] shared `NameDialog` (name + optional tags + extra body), used by the 4 dialogs; test
- [ ] `LibraryItemMenu` shared by the two card menus
- [ ] rewire components to the action hooks; lint overrides for components/hooks; BuilderBlock lint

**Batch 4 — robustness & docs** (DW 7–10)
- [ ] route error boundary + browser test
- [ ] small fixes (index keys, ColorPickerPopover effect, eslint-disable, useSaveStatus)
- [ ] rewrite architecture.md / conventions.md sections

## Drift log

_(empty)_
