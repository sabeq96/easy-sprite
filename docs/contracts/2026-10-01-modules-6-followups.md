# Modules 6: keys live on command definitions; lint globs reach every level

Status: building (agreed 2026-10-01)
Date: 2026-10-01
Depends on: [5 host modules](2026-10-01-modules-5-host-modules.md) (PR #32)

## Goal

Every command (tool, setting, host module, builder) declares its own `keys` next to its `run`,
and the active registry *is* the keymap. Adding a key-bound command to a host module touches
only that module's `commands.ts`, which closes stage 5's Done-when 3. Every lint pattern
blocks nested paths too.

## Non-goals

- No change to any key, label, group, tooltip, enabled or pressed state, or cheat-sheet content and order.
- No new lint bans for the newer folders (`editor/`, `tools/`, `framework/`) in the older overrides (D3). Only the glob depth changes.
- No change to how modules read state. Module commands keep reading their own stores; there's no interface layer like `ToolHost`.
- No change to the builder beyond giving its command definitions `keys`, and using the shared constant.
- No persistence of user-defined keys, and no rebinding UI.

## Decisions

| # | Decision | Why | Rejected alternative |
| --- | --- | --- | --- |
| D1 | **Keys on every definition.** `CommandDefinition` gains `keys?: readonly KeyBinding[]`. Host-module commands become static definition arrays (`{ id, label, group, keys?, isEnabled?(ctx), isActive?(ctx), run(ctx) }`), the same shape as `Tool.commands`, and the shell binds them to the `ModuleContext`. The keymap is the active registry. `SHORTCUTS`, `APP_SHORTCUTS` and `APP_COMMAND_IDS` are deleted | One command shape everywhere. A new command is one definition in one file | Per-module key files plus a central list for the shared commands (two mechanisms). Leaving the central tables |
| D2 | **The 9 cross-surface commands** (`edit.undo`, `edit.redo`, `edit.save`, `view.zoomIn`, `view.zoomOut`, `view.fit`, `view.toggleGrid`, `app.shortcutHelp`, `app.backToLibrary`) take their keys from one shared constant in `src/constants/shortcuts.ts`. The shell and view modules and the builder all reference it | Keys that two surfaces share have one source | Each surface writing its own copy |
| D3 | **Lint:** every single-level `@/x/*` group in `.oxlintrc.json` becomes `@/x/**`, and so does the `!@/tools/shared/*` negation. Nothing else changes in the config | A `*` doesn't cross `/` in oxlint. A dry run on a scratch copy of `src/` found 0 violations | Also banning the newer folders in the older overrides |
| D4 | Ids stay type-checked: `CommandId` is derived from the static definitions (tools, settings, module arrays) with no hand-kept list | Keeps the typo safety from stages 2–3 | Widening ids to `string` |
| D5 | `commandKeys(id)` and `reselectKeys(tool)` become hooks that read the active registry (`useCommandKeys(id)`, `useReselectKeys(tool)`). `useShortcuts` matches a key press against the registry's `keys` | Without a static table, keys are only known from the registry | A static table rebuilt from module imports (an import cycle; stage 5 task 7) |
| D6 | **The cheat sheet's group order and row order stay identical.** Groups follow the `CommandGroup` order in `constants/commands.ts`. Rows follow registry order, with `EDITOR_MODULES` order adjusted where needed (view before animation, so the View group stays zoom, fit, grid, onion). Pinned by a test | Under D1 the order would otherwise follow module order | Sorting rows alphabetically (a visible change) |
| D7 | Duplicate-chord and duplicate-id checks run per registry: the editor's merged registry, and the builder's | There's no global table to check any more | A global check |

## Interfaces

```ts
// src/commands/types.ts
export interface CommandDefinition {
  id: CommandId; label: string; group: CommandGroup;
  /** The chords that run this command; read by useShortcuts, tooltips and the cheat sheet. */
  keys?: readonly KeyBinding[];
  isEnabled?: () => boolean; isActive?: () => boolean; run: () => void; hold?: CommandHold;
}
export type CommandId = ToolCommandId | ContributedCommandId | SettingCommandId | ModuleCommandId;

// src/editor/module.ts
export interface ModuleCommand<Id extends string = string> {
  readonly id: Id; readonly label: string; readonly group: CommandGroup;
  readonly keys?: readonly KeyBinding[];
  isEnabled?(ctx: ModuleContext): boolean;
  isActive?(ctx: ModuleContext): boolean;
  run(ctx: ModuleContext): void;
  hold?(ctx: ModuleContext): CommandHold;      // toolbox's tool keys
}
export interface EditorModule { /* … */ readonly commands?: readonly ModuleCommand[] }

// src/constants/shortcuts.ts
export const SHARED_KEYS: Readonly<Record<SharedCommandId, readonly KeyBinding[]>>;  // the 9 of D2

// src/commands/CommandsContext.ts
export function useCommandKeys(id: CommandId): string[];   // formatted chords, empty when none
```

## Test approach

- **Unit:**
  - module command arrays bind to a fake `ModuleContext`;
  - per-registry duplicate-chord and duplicate-id tests (D7), for the editor and the builder;
  - a cheat-sheet order test (D6);
  - the existing keymap and contributed tests, rewritten against registries.
- **Browser:** all existing suites pass with assertions unchanged.
- **Probes**, each restored from a copy:
  - a throwaway key-bound command added only to `layers/commands.ts` shows its key in the cheat sheet and runs on keypress;
  - `<CommandButton command="layer.addd" />` fails `tsc -b`;
  - two-level imports are rejected where the one-level ban already applied, for example `import "@/components/common/CommandButton"` from `src/core/pixels.ts`, which passes lint today.
- **UI-identity dump:** the editor and the builder compared against #32. Every button, key, tooltip, the menus' keys and the cheat sheet must be byte-identical.

Command: `npm run lint && npm run build && npm run test:coverage && npm run test:browser`

## Done when

- [ ] 1. `grep -rnE "APP_COMMAND_IDS|APP_SHORTCUTS|\bSHORTCUTS\b|commandKeys\(" src` is empty.
- [ ] 2. Adding a key-bound command to a host module touches only that module's `commands.ts` (probe).
- [ ] 3. A command-id typo is a type error (probe).
- [ ] 4. The UI dump of the editor and the builder is byte-identical to #32, including cheat-sheet group and row order.
- [ ] 5. No `no-restricted-imports` group in `.oxlintrc.json` ends in a single `/*`, and a two-level probe is rejected.
- [ ] 6. `.claude/skills/triage/SKILL.md` names the real command sources: tool folders and `src/editor/<module>/commands.ts`.
- [ ] 7. The command above passes.

## Open risks

- Deriving `ModuleCommandId` from module arrays may need `as const` / `satisfies` and type-only imports into `commands/types.ts`. Check that `import/no-cycle` stays quiet. Fallback: each module exports its definitions from a leaf `commands.ts` that imports no components.
- The toolbox's commands are generated from `TOOL_LIST` (one per tool, plus contributed and setting commands). Their ids are already derived types, so they only need to be expressed as `ModuleCommand`s.

## Tasks

- [ ] `src/commands/types.ts`, `src/editor/module.ts`: the `keys` field, `ModuleCommand`, and the `CommandId` derivation → serves 1, 3
- [ ] `src/editor/*/commands.ts` (shell, palette, layers, frames, animation, view, toolbox): static definitions with `keys`; `modules.ts` order (D6) → serves 1, 2, 4
- [ ] `src/editor/shell/EditorPage.tsx`, `useModuleContext.ts`: bind module commands to the context → serves 1, 2
- [ ] `src/commands/keymap.ts`, `CommandsContext.ts`, `src/hooks/useShortcuts.ts`: the registry-based keymap and `useCommandKeys`/`useReselectKeys` → serves 1, 4
- [ ] The callers of `commandKeys` and `reselectKeys` (`CommandButton`, `GridOptionsPopover`, `OnionSkinControl`, `EditorMenu`, `EditorTopBar`, both `ShortcutHelpDialog`s, `SpritesheetMenu`, `SpritesheetBuilderPage`) → serves 1, 4
- [ ] `src/constants/commands.ts`, `src/constants/shortcuts.ts`: delete the app tables; add `SHARED_KEYS` → serves 1
- [ ] `src/commands/useBuilderCommands.ts`: `keys` from `SHARED_KEYS` → serves 4
- [ ] `.oxlintrc.json`: deepen the globs → serves 5
- [ ] `.claude/skills/triage/SKILL.md`, `docs/shortcuts.md` (implementation contract), `docs/architecture.md` §11, `docs/conventions.md` §10 → serves 6
- [ ] Tests listed in the test approach → serves 3, 4, 7

## Drift log
