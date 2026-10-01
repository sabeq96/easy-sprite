# Modules 0/5: rename the framework-free core to `src/core/`

Status: approved (2026-10-01)
Date: 2026-10-01
Depends on: nothing
Series: [0 core](2026-10-01-modules-0-core-rename.md) · [1 tool folders](2026-10-01-modules-1-tool-folders.md) · [2 tool interfaces](2026-10-01-modules-2-tool-interfaces.md) · [3 settings](2026-10-01-modules-3-settings.md) · [4 painters](2026-10-01-modules-4-renderer-painters.md) · [5 host modules](2026-10-01-modules-5-host-modules.md)

## Why this series exists

The maintainer's goal: **the editor is a host built from domain modules, and tools are
self-contained modules that consume the host only through interfaces.** Adding a tool is one
new folder plus one registry line. Simplicity comes first: when code can be smaller and more
uniform, it should be, and changes are additive wherever no integration point is needed.

When the series is done, the system has exactly three kinds of code, and one rule says which is which:

| Kind | Where | Role |
|---|---|---|
| **Core** | `src/core/` | Framework-free document, pixels, history and renderer. Knows nothing about tools or the host |
| **Host modules** | `src/editor/<domain>/` | Palette, layers, frames, animation, view, canvas, toolbox, shell. Each **provides** capabilities and owns its UI, state and commands |
| **Tools** | `src/tools/<tool>/` | **Consume** capabilities only through the interfaces in `src/framework/` |

Shared infrastructure (`db/`, `services/`, `export/`, `lib/`, `constants/`, `hooks/` used by
several surfaces, `components/ui` and `components/common`) stays where it is. The builder,
library and settings pages keep today's layout (a non-goal of the series).

A considered and rejected alternative was a separate "features" category (grid and onion skin as
plug-in modules). It would have been a third category without a clear rule. Grid now belongs to
the `view` host module, and onion skin to `animation`.

## Goal

`src/editor/` becomes `src/core/`, so that stage 5 can use `src/editor/<domain>/` for the pixel
editor's host modules. This is a mechanical rename with no logic change.

## Non-goals

- No file is renamed inside the folder, and nothing moves out of it. `editor/tools/` moves in stage 1.
- `tests/browser/editor/` keeps its name (it tests the editor UI, not the core).

## Decisions

| # | Decision | Why | Rejected alternative |
|---|----------|-----|----------------------|
| 1 | **Settled by the maintainer.** Rename the core to `src/core/`, and use `src/editor/<domain>/` for host modules (stage 5) | Names match meaning: "editor" is the editor | Host in `src/host/` with the core keeping `src/editor/`. Host in `src/features/` |
| 2 | One PR containing only the rename. Every `@/editor/` import becomes `@/core/` | A reviewer can trust a pure `git mv` + sed diff | Folding it into stage 1 |
| 3 | `tests/unit/editor/` becomes `tests/unit/core/` (conventions §11: tests mirror `src/`) | Keeps the mirror rule | Leaving the old name |

## Files

- `git mv src/editor src/core` and `git mv tests/unit/editor tests/unit/core`.
- Every `@/editor/` import in `src/` and `tests/` (104 files today): `sed -i '' 's#@/editor/#@/core/#g'`.
- `.oxlintrc.json`:
  - the override `files: ["src/editor/**"]` becomes `["src/core/**"]`, and its message changes;
  - `@/editor/*` becomes `@/core/*` in the `db/`, `lib/`+`constants/` and `types/` groups.
- `docs/architecture.md` (§1, §2 folder map, §9 table), `docs/conventions.md` (§1 table, §5, §10, §11 examples), `docs/shortcuts.md`, `.claude/skills/review-contribution/SKILL.md` and `.claude/skills/triage/SKILL.md`: `src/editor` → `src/core`. `docs/phases/` and earlier `docs/contracts/` are historical and are left alone.

## Test plan

No new tests. Every existing test passes, with only its import paths changed.

Command: `npm run lint && npm run build && npm run test:coverage`

## Done when

- [x] 1. `grep -rn "@/editor/" src tests` is empty, and `src/editor/` does not exist.
- [x] 2. Lint rejects `import { useState } from "react"` in `src/core/pixels.ts` (probe it, then revert).
- [x] 3. The diff contains renames and import-path changes only (`git diff -M --stat` plus a skim).
- [x] 4. The command above passes.

## Open risks

- None beyond merge conflicts. Land it when no other branch touches the core.

## Open questions for the maintainer

None.

## Drift log

- 2026-10-01 (build): no deviation in scope. Prose that says "the editor core" without a path
  (the `src/db/**` lint message, conventions.md §1 "wires the DB to the editor core" and §10
  "`db/` never imports the editor or UI") was left as is, because this stage changes path strings
  only. Stage 5 may want to reword it once `src/editor/` means the host.
