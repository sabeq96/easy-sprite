# Contract — architecture cleanup (boundaries, dedup, consistency)

Status: **proposed**

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

## Non-goals

- No splitting of oversized files (`PalettePanel`, `useEditorCommands`, `document.ts`, …) — C3.
- No merging of the editor and builder viewport stacks — B7.
- No visual/UX changes, no new features, no dependency upgrades or package.json moves.
- No changes to `src/components/ui/**` beyond what is needed to clear the 2 lint errors (adding a
  variant if required).
- No change to the persisted schema / DB versions.

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
8. `docs/architecture.md` folder map and DAG match the tree.

## Task list

_(appended after approval)_

## Drift log

_(empty)_
