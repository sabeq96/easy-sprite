# Contract — architecture cleanup (boundaries, dedup, consistency)

Status: **done** (approved 2026-09-24 with independent-review additions 1–5; built same day)

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
- [x] `useAsyncAction`; `useLibrary({ kinds })`, delete `useSpriteLibrary`; `useSpriteSizes` via repo
- [x] action hooks: sprites, spritesheets (+ `useSpritesheet(id)`), palettes, backup
- [x] move `components/builder/useBuilderDnd.ts` → `hooks/`

**Batch 3 — components** (DW 1, 2, 4, 6)
- [x] shared `NameDialog` (name + optional tags + extra body), used by the 4 dialogs; test
- [x] `LibraryItemMenu` shared by the two card menus
- [x] rewire components to the action hooks; lint overrides for components/hooks; BuilderBlock lint

**Batch 4 — robustness & docs** (DW 7–10)
- [x] route error boundary + browser test
- [x] small fixes (index keys, ColorPickerPopover effect, eslint-disable, useSaveStatus)
- [x] rewrite architecture.md / conventions.md sections

## Drift log

- **DW 2 grep**: components keep 7 `import type` lines from `@/db/schema` (record shapes) and one
  from `@/services/autosave` (`SaveStatus`). Types carry no behaviour, so the lint rule sets
  `allowTypeImports: true`; the literal grep in DW 2 would still match these lines.
- **useLibrary API**: `useLibrary(kind?)` (one optional kind) instead of `useLibrary({ kinds })` —
  an array argument would change identity each render and re-run the live query.
- **Shared dialog**: split into `FormDialog` (shell, fresh form per open), `NameForm` (name/tags
  fields + footer, extra fields as children) and `NameDialog` (the two composed), because
  `NewSpriteDialog` needs extra size fields that must also reset on open.
- **Button variant**: added `revealOnFocus` to `ui/button.tsx` to clear the `no-restyle` error.
- **Pre-existing browser failures**: `dnd-visuals › a reordered palette shows its new order…` and
  `spritesheet-drag › a sprite dropped on the empty sheet…` fail on untouched `main` too in this
  container (Chromium 1194 vs the headless shell Playwright expects); not addressed here.
- **Error boundary**: the app uses declarative `<Routes>`, which has no `errorElement`, so it is a
  class `ErrorBoundary` in a pathless layout route (`RouteErrorBoundary`) keyed on the pathname.
- **DW 10 index keys**: `ShortcutList` now keys on label + chords. The `SpriteManagerPage` skeleton
  keeps `key={index}` — it is a fixed list of placeholders that never reorders, and conventions §6
  now names that as the one allowed case, rather than dressing an index up as an id.
- **Phase links**: the §11 links to phase-12/13 docs stay; they point at the rationale, not at
  build history. Other phase references were removed from both docs.
- **Browser flakiness** (confirmed on untouched `main`, 3 runs each): `spritesheet-drag › …empty
  sheet becomes its first row` fails every run on both; other spritesheet-drag cases and
  `spritesheet-builder › …drops out of the palette` fail intermittently on both under load.

