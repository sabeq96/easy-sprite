# Modules 1/5: one folder per tool, carrying its icon

Status: approved (2026-10-01)
Date: 2026-10-01
Depends on: [0 core](2026-10-01-modules-0-core-rename.md) merged
Series: [0 core](2026-10-01-modules-0-core-rename.md) · [1 tool folders](2026-10-01-modules-1-tool-folders.md) · [2 tool interfaces](2026-10-01-modules-2-tool-interfaces.md) · [3 settings](2026-10-01-modules-3-settings.md) · [4 painters](2026-10-01-modules-4-renderer-painters.md) · [5 host modules](2026-10-01-modules-5-host-modules.md)

## Context

Read "Why this series exists" in [stage 0](2026-10-01-modules-0-core-rename.md) first. This stage
is a **pure move**: there is no behaviour change, and every test stays green after its imports
are updated.

## Goal

- Every tool lives in `src/tools/<folder>/tool.ts` and declares its own icon.
- The host↔tool contract (`Tool`, `ToolContext`, `ToolSession`, `defineTool`, …) lives in
  `src/framework/tool.ts`. Stage 2 replaces its internals with capability interfaces.
- The registry is `src/tools/index.ts`, and adding a tool is one appended line.
- Lint enforces isolation:
  - A tool folder can't import another tool folder or any host state.
  - `src/core/` can't import `framework/` or `tools/`.
- `src/components/editor/toolIcons.ts` is deleted.

## Non-goals

- No change to what tools receive (`ToolContext` and `ToolSession` move as-is, and stage 2 replaces them).
- No change to tool options (stage 3) or to commands (stage 2).
- The brush cursor overlay stays in `src/core/overlays/`, still driven by `usePointerPaint` (stage 3 moves it).
- The selection pixel helpers (`core/selection.ts`, `core/commands/selection.ts`, `core/clipboard.ts`) stay put (stage 2 moves them).
- No auto-discovery (Decision 2).

## Decisions

| # | Decision | Why | Rejected alternative |
|---|----------|-----|----------------------|
| 1 | **Settled by the maintainer.** Tools live in `src/tools/<folder>/`, holding everything they need: logic, icon, JSX, commands | One place per tool | Relaxing the core's lint rule and keeping tools there |
| 2 | **Settled by the maintainer.** Registration is one explicit line in `TOOL_LIST` | Keeps `ToolId` and `` `tool.${ToolId}` `` exact literal types, and the list order is the sidebar order | `import.meta.glob` auto-discovery |
| 3 | **Settled by the maintainer.** A tool may ship JSX (data first, JSX allowed) | Generic host controls cover the common case | Data only. JSX only |
| 4 | **Settled by the maintainer (2026-10-01).** The host↔tool contract lives in a new `src/framework/` folder. It contains types and tiny pure helpers only (`tool.ts` now, and `host.ts`, `command.ts` and `settings.ts` later) | Tools and host modules both depend on it. It can't live in `core/`, because it references icon and component *types* | `src/tools/types.ts`. `src/types/` |
| 5 | Each tool folder's entry file is `tool.ts`, not `index.ts` | conventions §5: import from the file, and only registries are barrels | `index.ts` per folder |
| 6 | Bucket and Fill similar share `src/tools/fill/tool.ts` (the existing `createFill` factory). The registry imports two tools from it | It's one module with two adapters | Two folders duplicating the factory |
| 7 | Code shared by several tools lives in `src/tools/shared/` (`paint.ts` now). Tool folders may import `@/tools/shared/*` and nothing else under `@/tools` | The paint primitives are used by pencil, eraser and fill | Copies |
| 8 | `Tool` gains `readonly icon: LucideIcon`. `ToolSidebar` renders `tool.icon` | The icon is part of the tool, and `toolIcons.ts` goes away | A parallel icon map |
| 9 | `ToolPoint` becomes an alias of `Point` from `@/core/viewport`. Core overlays import `Point` from there | The core must not import `framework/` | Moving `ToolPoint` into core |
| 10 | **Lint**, as one override for `src/tools/*/**` (every tool folder, `shared/` included):<br>• No `@/db/*`, `@/services/*`, `@/export/*`, `dexie*`, `@/stores/*`, `@/app/*` or `@/hooks/*`.<br>• No `@/commands/*` except type-only imports.<br>• No `@/tools` and no `@/tools/*` except `@/tools/shared/*`.<br>• No `../*`.<br>`src/framework/**` follows the `stores/` rule (no components, hooks, app or React runtime), with type-only imports allowed. The `core/**` rule adds `@/framework/*` and `@/tools*` | Isolation is checked, not only promised | Dropping rules wholesale |
| 11 | Tests mirror the move: `tests/unit/core/tools/*` becomes `tests/unit/tools/*`, changing only imports | conventions §11 | Old paths |

## Layout after this stage

```text
src/framework/
  tool.ts              ← src/core/tools/types.ts (+ icon, ToolPoint = Point)
src/tools/
  index.ts             ← src/core/tools/index.ts (TOOL_LIST, ToolId, TOOLS, getTool)
  shared/paint.ts      ← src/core/tools/paint.ts
  pencil/tool.ts       ← src/core/tools/pencil.ts   (+ icon: Brush)
  eraser/tool.ts       ← src/core/tools/eraser.ts   (+ icon: Eraser)
  fill/tool.ts         ← src/core/tools/fill.ts     (+ icons: PaintBucket, Blend)
  picker/tool.ts       ← src/core/tools/picker.ts   (+ icon: Pipette)
  select/tool.ts       ← src/core/tools/select.ts   (+ icon: SquareDashed)
  select/overlay.ts    ← src/core/overlays/selectionOverlay.ts
deleted: src/core/tools/, src/components/editor/toolIcons.ts
```

## Files

- The moves above, with every importer updated (`grep -rn "@/core/tools\|toolIcons\|overlays/selectionOverlay" src tests`).
- `src/components/editor/ToolSidebar.tsx`: `const Icon = tool.icon`. Serves 8.
- `src/core/overlays/brushCursor.ts`: `Point` from `@/core/viewport`. Serves 9.
- `.oxlintrc.json`: Decision 10.
- `docs/architecture.md`:
  - §2: add `framework/` and `tools/`.
  - §9: add their rows, and rewrite the "known compromises" paragraph (the hint type is now borrowed by `framework/`).
- `docs/conventions.md`:
  - §1: "a tool → `src/tools/<folder>/tool.ts`".
  - §5: the registry is `src/tools/index.ts`.
  - §10: the new override.
- `docs/shortcuts.md`, `.claude/skills/review-contribution/SKILL.md` and `CONTRIBUTING.md`: the new tool path, and "adding a tool = a folder plus one line in `TOOL_LIST`".

## Test plan

- Move `tests/unit/core/tools/{select,toolOptions,tools}.test.ts` to `tests/unit/tools/`, changing imports only.
- New `tests/unit/tools/registry.test.ts`:
  - Every tool has an `icon`, and ids are unique.
  - The order is `pencil, eraser, bucket, fillSimilar, picker, select`.
- All browser suites pass unchanged.

Command: `npm run lint && npm run build && npm run test:coverage`

## Done when

- [x] 1. `src/core/tools/` and `toolIcons.ts` are gone, and `grep -rn "@/core/tools" src tests` is empty.
- [x] 2. Icons are declared in each `tool.ts`, and the sidebar is unchanged.
- [x] 3. Lint rejects each probe (add it, run lint, revert):
  - `import "@/tools/eraser/tool"` in the pencil
  - `import "../eraser/tool"` there
  - `import { useEditorStore } from "@/stores/useEditorStore"` there
  - `import "@/framework/tool"` in `src/core/pixels.ts`
- [x] 4. Docs and the review skill name the new paths.
- [x] 5. The command above passes, with no assertion changed.

## Open risks

- Check that oxlint's `group` patterns support `!@/tools/shared/*` negation. If not, use the
  `regex` form `^@/tools(?!/shared/)` and log it in the drift log.
- `import/no-cycle` with type-only edges (`framework/tool.ts` → `commands/hints` → … →
  `tools/index.ts`). The same edge exists today. If it trips, move `Hint` into `framework/`.

## Open questions for the maintainer

None. Decision 4 was approved on 2026-10-01.

## Drift log

- **2026-10-01, lint glob depth (Open risk 1).** `!` negation in `group` patterns works in oxlint
  1.83, so the `regex` form was not needed. But in oxlint a `*` in a group pattern does not cross
  `/`: `@/tools/*` does not match `@/tools/eraser/tool`, `../*` does not match `../eraser/tool`,
  and `@/stores/*` does not match `@/stores/slices/toolSlice`. So the patterns this stage adds use
  `/**`: `@/tools/**` with `!@/tools/shared/*`, `../**`, `@/db/**`, `@/stores/**`, `@/commands/**`
  (and so on) in the `src/tools/*/**` override, `@/components/**`, `@/hooks/**` and `@/app/**` for
  `src/framework/**`, and `@/framework/**` and `@/tools/**` added to `src/core/**`. The older
  overrides still use single `*`, so today they only block the first level under each folder (for
  example, `core/` could import `@/components/editor/X`). Fixing that is outside this stage.
- **2026-10-01, select overlay import.** `select/tool.ts` imports its overlay as `./overlay`, not
  `@/tools/select/overlay`, because Decision 10 forbids `@/tools/*` other than `shared/` inside a
  tool folder (conventions §5 allows `./` within a folder).
- **2026-10-01, files outside the list.** `.claude/skills/triage/SKILL.md` also named
  `src/core/tools/index.ts`; its path now reads `src/tools/index.ts`. The registry comment in
  `src/tools/index.ts` now says "its folder plus one line here" instead of "(plus its icon)".
- **2026-10-01, architecture §9 importers.** Besides the new `framework/` and `tools/` rows, the
  `stores/`, `commands/`, `hooks/` and `components/` rows now list `framework`/`tools` (they used
  to reach tools through `core`), and the `core/` row drops "types from commands/hints", since
  `core/` no longer imports it.
- **Not hit: Open risk 2.** `import/no-cycle` passed with the type-only
  `framework/tool.ts → commands/hints` edge, so `Hint` stayed in `commands/`.
