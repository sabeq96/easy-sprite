# Modules 6: keys live on command definitions; lint globs reach every level

Status: done
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

- [x] 1. `grep -rnE "APP_COMMAND_IDS|APP_SHORTCUTS|\bSHORTCUTS\b|commandKeys\(" src` is empty.
- [x] 2. Adding a key-bound command to a host module touches only that module's `commands.ts` (probe).
- [x] 3. A command-id typo is a type error (probe).
- [x] 4. The UI dump of the editor and the builder is byte-identical to #32, including cheat-sheet group and row order.
- [x] 5. No `no-restricted-imports` group in `.oxlintrc.json` ends in a single `/*`, and a two-level probe is rejected.
- [x] 6. `.claude/skills/triage/SKILL.md` names the real command sources: tool folders and `src/editor/<module>/commands.ts`.
- [x] 7. The command above passes.

## Open risks

- Deriving `ModuleCommandId` from module arrays may need `as const` / `satisfies` and type-only imports into `commands/types.ts`. Check that `import/no-cycle` stays quiet. Fallback: each module exports its definitions from a leaf `commands.ts` that imports no components.
- The toolbox's commands are generated from `TOOL_LIST` (one per tool, plus contributed and setting commands). Their ids are already derived types, so they only need to be expressed as `ModuleCommand`s.

## Tasks

- [x] `src/commands/types.ts`, `src/editor/module.ts`: the `keys` field, `ModuleCommand`, and the `CommandId` derivation → serves 1, 3
- [x] `src/editor/*/commands.ts` (shell, palette, layers, frames, animation, view, toolbox): static definitions with `keys`; `modules.ts` order (D6) → serves 1, 2, 4
- [x] `src/editor/shell/EditorPage.tsx`, `useModuleContext.ts`: bind module commands to the context → serves 1, 2
- [x] `src/commands/keymap.ts`, `CommandsContext.ts`, `src/hooks/useShortcuts.ts`: the registry-based keymap and `useCommandKeys`/`useReselectKeys` → serves 1, 4
- [x] The callers of `commandKeys` and `reselectKeys` (`CommandButton`, `GridOptionsPopover`, `OnionSkinControl`, `EditorMenu`, `EditorTopBar`, both `ShortcutHelpDialog`s, `SpritesheetMenu`, `SpritesheetBuilderPage`) → serves 1, 4
- [x] `src/constants/commands.ts`, `src/constants/shortcuts.ts`: delete the app tables; add `SHARED_KEYS` → serves 1
- [x] `src/commands/useBuilderCommands.ts`: `keys` from `SHARED_KEYS` → serves 4
- [x] `.oxlintrc.json`: deepen the globs → serves 5
- [x] `.claude/skills/triage/SKILL.md`, `docs/shortcuts.md` (implementation contract), `docs/architecture.md` §11, `docs/conventions.md` §10 → serves 6
- [x] Tests listed in the test approach → serves 3, 4, 7

## Drift log

- **2026-10-01, D6: `COMMAND_GROUPS`, and the group order it encodes.** "Groups follow the
  `CommandGroup` order" → `CommandGroup` was a type-only union (`Tools | Edit | Color | Layers |
  Frames | View | App`), so there was no runtime order, and its member order put Layers before
  Frames, while the sheet on #32 shows Edit, Color, **Frames, Layers**, View, App (it followed
  `APP_SHORTCUTS`' insertion order) → `src/constants/commands.ts` now exports
  `COMMAND_GROUPS = ["Tools", "Edit", "Color", "Frames", "Layers", "View", "App"]` and derives
  `CommandGroup` from it; the common `ShortcutHelpDialog` lists groups in that order (hint-only
  groups too, at their place; none exists today). Why: D6's substance is "identical order", and
  the old union order would have swapped Frames and Layers. Rows within a group follow registry
  order, then the hints.
- **2026-10-01, D6: `EDITOR_MODULES` is `[shell, palette, layers, frames, view, animation, toolbox,
  canvas]`.** View before animation, as decided. `attachCanvas` now registers the grid painter
  (view, `overlay` channel) before the onion painter (animation, `onion` channel): the task 5
  order. `renderPainters` draws only the painters of the channel it renders, so stacking is
  unchanged ("the selection fill draws above the grid lines" and the onion tests pass). No hint
  moved: view and animation declare none.
- **2026-10-01, D4: how the ids stay literal (Open risk 1: hit, no fallback needed).** "`CommandId`
  is derived from the static definitions" → it takes two identity helpers in
  `src/editor/module.ts`, not in the Interfaces sketch:
  - `defineCommands<const Id>(commands: readonly ModuleCommand<Id>[])` keeps each definition's
    literal id. Context-sensitive handlers (`run: ({ doc }) => …`) do not break the inference,
    because `Id` is inferred from `id` alone (the stage 2 limit was about inferring a whole tuple).
  - `defineModule<Id = never>(module: EditorModule<Id>)`: `EditorModule` gained a defaulted
    `Id extends string = string` parameter (`commands?: readonly ModuleCommand<Id>[]`). Typing
    each module as `EditorModule` erased the ids; `satisfies EditorModule` kept them but also
    narrowed `attachCanvas` to the painter's own one-parameter signature, which broke the
    `attachCanvas(renderer, doc)` calls in the animation and view module tests.
  - `src/editor/modules.ts` keeps the precise list (`MODULES`), exports it widened as
    `EDITOR_MODULES: readonly EditorModule[]`, and derives
    `ModuleCommandId = CommandIdOf<(typeof MODULES)[number]>`. `src/commands/types.ts`
    type-imports it: `CommandId = ToolCommandId | ContributedCommandId | SettingCommandId |
    ModuleCommandId`. `import/no-cycle` ignores type-only imports (oxlint's `ignoreTypes`
    defaults to `true`), so lint stays quiet; there is no type-level circularity either.
  - The toolbox's commands are generated, so they are annotated rather than inferred:
    `TOOL_COMMANDS: readonly ModuleCommand<ToolCommandId>[]` and
    `CONTRIBUTED_COMMANDS: readonly ModuleCommand<ContributedCommandId | SettingCommandId>[]`.
- **2026-10-01, D1: where binding lives.** `bindCommands(commands, ctx)` (in `src/editor/module.ts`)
  turns definitions into registry entries; `bindEditorCommands(ctx)` (in `src/editor/modules.ts`,
  next to `subscribeToModules`, so tests bind the real merge) binds every module's commands in
  module order. `EditorShell` calls it where it merged `commands(ctx)` registries;
  `useModuleContext.ts` did not need to change. A definition's missing `isEnabled`, `isActive`,
  `keys` or `hold` stays `undefined` after binding, so `CommandButton` still tells toggles apart.
- **2026-10-01, D1: the toolbox.** A new `src/editor/toolbox/commands.ts` exports
  `TOOLBOX_COMMANDS = [...TOOL_COMMANDS, ...CONTRIBUTED_COMMANDS]`, so every host module's commands
  are in its `commands.ts`. `TOOL_COMMANDS` (`toolCommands.ts`) is one definition per tool with
  `keys: [tool.shortcut]` and `hold: () => toolKeyHold(tool)`, which the shell binds per render as
  `createToolCommands()` did. `CONTRIBUTED_COMMANDS` (`contributed.ts`) wraps each tool command
  and setting command; its handlers call `ctx.forTool(toolId)` when they run (the view is cached,
  so it is the same host the old registry captured). `createToolCommands` and
  `createContributedCommands` are gone.
- **2026-10-01, D5: no `useReselectKeys` hook; the sheet reads its own registry.** "`commandKeys`
  and `reselectKeys` become hooks" → `useCommandKeys(id)` is the hook (in `CommandsContext.ts`;
  empty outside a provider, so `OnionSkinControl`'s own test still renders without one).
  `reselectKeys(tool, registry)` stays a plain function in `keymap.ts`, next to `keysOf(command)`
  and `boundCommand(registry, event)`. Why: its only caller is the editor's cheat sheet, which
  builds rows in a loop over `TOOL_LIST`, where a hook cannot run, and which already receives the
  active registry as `commands`; a `useReselectKeys` hook would have had no caller. The builder's
  Back link is the other exception: it renders in `SpritesheetBuilderShell`, the component that
  creates the `CommandsProvider`, so a hook there would read no provider; it reads
  `keysOf(commands["app.backToLibrary"])` from the registry it just built. Every other caller
  (`CommandButton`, `GridOptionsPopover`, `OnionSkinControl`, `EditorMenu`, `EditorTopBar`,
  `SpritesheetMenu`) uses `useCommandKeys`.
- **2026-10-01, D5: `useShortcuts`.** It calls `boundCommand(commandsRef.current, event)`, the first
  registered command whose `keys` match. Before, it walked the global table and stopped at the
  first matching chord even when its command was not registered. With no duplicate chord in a
  registry (D7), both pick the same command, and an unbound key is still left to the browser.
- **2026-10-01, D2: `SharedCommandId`** is the literal union of the nine ids in
  `src/constants/shortcuts.ts` (constants import no command types, and deriving it from
  `CommandId` would make the module definitions that read `SHARED_KEYS` depend on their own
  ids). `tests/unit/editor/modules.test.ts` checks `SharedCommandId extends CommandId` with
  `expectTypeOf`, and that the editor's shared commands carry the `SHARED_KEYS` arrays
  themselves (`toBe`); the builder test checks the same for `useBuilderCommands`.
- **2026-10-01, D3: lint.** 40 single-level group patterns became `/**` (`@/components/*` ×8,
  `@/app/*` ×6, `@/hooks/*` ×6, `@/db/*` ×5, `@/services/*` ×4, `@/core/*`, `@/export/*` and
  `@/stores/*` ×3 each, `@/lib/*` and `@/commands/*` ×1), and `!@/tools/shared/*` became
  `!@/tools/shared/**`. Nothing else in `.oxlintrc.json` changed: the file equals #32's with
  `"@/x/*"` → `"@/x/**"` applied (checked with `diff`). `npm run lint` reports 0 errors and the ten known warnings.
  Probes (each file restored from a copy; the old config ran from a temporary copy of the #32
  `.oxlintrc.json`, then deleted):
  - `import "@/components/common/CommandButton"` in `src/core/pixels.ts`,
    `import "@/core/commands/layers"` in `src/db/db.ts` and `import "@/db/repositories/sprites"`
    in `src/components/common/Panel.tsx` are rejected; with the old config all three passed.
  - In `src/tools/eraser/tool.ts`, `@/tools/pencil/tool` is still rejected, and
    `@/tools/shared/brush` and a nested `@/tools/shared/zz/deep` pass.
- **2026-10-01, Done-when probes.**
  - 2: a `layer.zzProbe` definition ("Probe new layer", `keys: [{ key: "j" }]`, adds a layer)
    added only to `src/editor/layers/commands.ts`; `git diff --stat` changed only in that file's
    line. `tsc -b` and `npx oxlint src/editor/layers` passed, and a throwaway browser test saw the
    Layers rows `New layer⌘⇧N, Merge layer down⌘E, Select layer abovePgUp, Probe new layerJ,
    Select layer belowPgDn` and two layers after `J`. Restored from a copy.
  - 3: `<CommandButton command="layer.addd" />` in `LayersPanel.tsx` fails `tsc -b` with
    `TS2820: Type '"layer.addd"' is not assignable to type 'CommandId'. Did you mean
    '"layer.add"'?`. Restored from a copy.
  - Mutation checks, each restored from a copy: with `EDITOR_MODULES` back to animation before
    view, "the editor's sheet lists its groups and rows in a fixed order" fails; with
    `color.reset` bound to `N`, "binds no chord to two commands in the editor's registry" fails.
- **2026-10-01, Done-when 4: UI identity.** A throwaway browser probe ran on this tree and on
  `refactor/modules-5-8-canvas` (`1188a1e`, PR #32's tip) in a scratch worktree, then removed. It
  reads only the DOM and `session()`. Editor (16×16): every button (name, disabled,
  `aria-pressed`, `aria-keyshortcuts`) at open (42) and at the end (49); all 26 tooltips (text and
  each `kbd`); the sprite menu (items and shortcut text); the whole cheat sheet (sections, rows,
  keys) opened by `?`, by the button, and again at the end; and after each of 42 steps the
  pressed buttons, options bar, status bar, layers, frame count, painted pixels, undo/redo state
  and zoom. Steps: tool taps E, B, P, G (`pressKey`, 50 ms), holds O and S (900 ms), P again ×2,
  V on and off, E again; paint, ⌘Z, ⌘⇧Z, ⌘A, ⌘C, Del, Esc, ⌘V, Esc; X, D; ⌘⇧N, PgUp, PgDn,
  PgUp, ⌘E; N, ⇧N, `,`, `.`, ⌥`.`, ⌥`,`; `=`, `+`, `-`, `0`, ⌘G, ⌘⇧O; then ⇧Esc (back to the
  library). Builder (one 8×8 sprite placed): every button (10), all 9 tooltips, the spritesheet
  menu, the cheat sheet both ways, and the buttons and header after `=`, `-`, `_`, `0`, ⌘G ×2,
  ⌘Z, `pexv` and ⌘⇧O (no effect), then ⇧Esc. The dumps are byte-identical: editor 25,613 bytes,
  md5 `08817583…` on both; builder 8,991 bytes, md5 `99ade705…` on both. (`userEvent`'s
  `{Shift>}{Escape}` did not reach the handler on either tree, so the probe dispatched the ⇧Esc
  `keydown` on `window` directly, on both.)
- **2026-10-01, tests.** Unit 328 → 335, browser 275 → 279.
  - New: `tests/support/modules.ts` (`moduleContext()`: a `ModuleContext` whose `dispatch` records
    into its history and whose `forTool` uses that document's tool host);
    `tests/browser/flows/shortcut-sheet.browser.test.tsx` (D6: both sheets' section titles and row
    labels, in order; keys are left out because their glyphs depend on the platform, and the dump
    covers them); `tests/browser/commands/useBuilderCommands.browser.test.tsx` (D7 for the builder:
    each entry's id matches its key, no chord twice; and every key array is `SHARED_KEYS`').
  - `tests/unit/editor/modules.test.ts`: the editor's per-registry id and chord checks (D7), the
    `SHARED_KEYS` identity, the derived-id type checks, and `bindCommands` tests (order, wording,
    keys, undeclared parts stay `undefined`, layer/frame commands against the context's document
    and history, a bound tool key's hold).
  - `tests/unit/commands/keymap.test.ts` reads the bound editor registry. The global "never binds
    one chord to two commands" case moved to `modules.test.ts` as the per-registry check. Same
    expected keys for the tool shortcuts, the press-again labels, and V vs ⌘V; new cases for
    `keysOf` and `boundCommand`.
  - Setup only: `contributed.test.ts`, `toolCommands.test.ts` and `tools/select.test.ts` bind
    `CONTRIBUTED_COMMANDS`/`TOOL_COMMANDS` with `moduleContext()` instead of calling the deleted
    factories; `contributed.test.ts` reads `commands[id]?.keys` where it read `SHORTCUTS[id]`, with
    the same expected values.
  - Browser, setup only, assertions unchanged: `ToolOptionsBar` builds its registry with
    `bindCommands(TOOLBOX_COMMANDS, moduleContext())`; `useShortcuts`' `edit.undo` and
    `tool.eraser` fixtures gain `keys` (⌘Z from `SHARED_KEYS`, `e`), since the hook now matches the
    registry's keys; `CommandButton`'s "the tooltip shows … every one of its keys" fixture gains
    `keys: SHARED_KEYS["edit.redo"]`, and its loop iterates `SHARED_KEYS["edit.redo"].map(formatBinding)`
    instead of `commandKeys("edit.redo")` (the same strings).
- **2026-10-01, files outside the list.**
  - `src/editor/*/module.ts` (all eight): `defineModule`, and `commands` is the static array.
  - `src/editor/toolbox/commands.ts` (new), `toolCommands.ts` and `contributed.ts`: see the toolbox
    entry.
  - `.claude/skills/review-contribution/SKILL.md`: it told contributors to put an id in
    `src/constants/commands.ts` and a key in `src/constants/shortcuts.ts`.
  - `docs/architecture.md` §2 (the `commands/` line) and §9 (the `commands/` row gains "types from
    editor/modules", the type edge is listed with the known compromises, "imports a module at
    runtime", and the single-`*` paragraph now says every group uses `/**`); `docs/conventions.md`
    §1's example (`FRAME_COMMANDS` for `frameCommands()`). All were stale after this change.
