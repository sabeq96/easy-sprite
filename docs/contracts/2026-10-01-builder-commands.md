# Builder commands in sync with the editor

Status: done
Date: 2026-10-01
Branch: `refactor/builder-commands` on top of `refactor/modules-6-followups` (PR #33)

## Goal
The spritesheet builder declares its commands the way editor modules do (static definitions bound to
a context), `CommandId` includes the builder's ids so a builder-only command is possible, and the
five session commands (undo, redo, save, help, back) are defined once and bound by both surfaces.

## Non-goals
- No builder-only command is added (D3); the path is only made possible.
- No change to labels, keys, order, UI or behaviour on either surface.
- The four view commands stay defined per surface (different stores and maths); no view adapter.
- No `src/builder/` folder or host-module split of the builder; builder files stay where they are.
- No change to `DocumentProvider` / `SpritesheetProvider`.
- The 26 files importing `defineCommands` from `@/editor/module` are not touched.

## Facts
- F1 `CommandId` (`src/commands/types.ts`) = tool ids ∪ `ModuleCommandId`; the builder can only use editor ids.
- F2 `useBuilderCommands` hand-writes 9 entries; 5 duplicate `src/editor/shell/commands.ts`.
- F3 `defineCommands`/`bindCommands`/`ModuleCommand` live in `src/editor/module.ts`, typed to `ModuleContext`.
- F4 `SHARED_KEYS` holds keys for those 9 ids so the surfaces cannot drift.
- F5 `tests/browser/commands/useBuilderCommands.browser.test.tsx` asserts no duplicate chord and id set == `SHARED_KEYS`.
- F6 builder `view.fit` needs the packed sheet size, computed in render.

## Decisions
| # | Decision | Why | Rejected alternative |
|---|----------|-----|----------------------|
| D1 | Generic command spec, `commandsFor<Ctx>()` and `bindCommands` move to `src/commands/define.ts`; `src/editor/module.ts` keeps `ModuleCommand` as an alias and `defineCommands = commandsFor<ModuleContext>()` | Builder must not import the editor; alias keeps the 26 importers unchanged | Builder imports from `@/editor/module` |
| D2 | `SHARED_KEYS` shrinks to `view.zoomIn`, `view.zoomOut`, `view.fit`, `view.toggleGrid`; session keys sit on their one definition | One place per key | Share view commands via an adapter; leave `SHARED_KEYS` whole |
| D3 | No new builder-only command | Enabling change only | Make Export a command |

## Interfaces

Planned changes as diffs. `…` marks bodies copied over unchanged.

New: the shared command shape and binding, moved out of the editor so the builder can use them.

```diff
+// src/commands/define.ts
+/** One command a surface declares: its keys, its state and what it runs, read from a context. */
+export interface CommandSpec<Id extends string, Ctx> {
+  readonly id: Id;
+  readonly label: string;
+  readonly group: CommandGroup;
+  readonly keys?: readonly KeyBinding[];
+  isEnabled?(ctx: Ctx): boolean;
+  isActive?(ctx: Ctx): boolean;
+  run(ctx: Ctx): void;
+  hold?(ctx: Ctx): CommandHold;
+}
+
+/** A `defineCommands` for one context type, keeping each definition's literal id. */
+export function commandsFor<Ctx>() {
+  return <const Id extends string>(commands: readonly CommandSpec<Id, Ctx>[]) => commands;
+}
+
+export function bindCommands<Ctx>(commands: readonly CommandSpec<string, Ctx>[], ctx: Ctx): CommandRegistry {
+  …moved unchanged from src/editor/module.ts
+}
```

New: the five commands both surfaces share, defined once.

```diff
+// src/commands/session.ts
+/** What every editing surface offers its session commands, whatever document it edits. */
+export interface SessionContext {
+  readonly history: History;
+  navigate(to: string): void;
+  showHelp(): void;
+  save(): Promise<void>;
+}
+
+export const SESSION_COMMANDS = commandsFor<SessionContext>()([
+  { id: "edit.undo", label: "Undo", group: "Edit", keys: [{ key: "z", mod: true }], … },
+  { id: "edit.redo", …, keys: [{ key: "z", mod: true, shift: true }, { key: "y", mod: true }] },
+  { id: "edit.save", …, keys: [{ key: "s", mod: true }] },
+  { id: "app.shortcutHelp", …, keys: [{ key: "?" }] },
+  { id: "app.backToLibrary", …, keys: [{ key: "escape", shift: true }] },
+]);
```

The editor builds on it; the 26 files calling `defineCommands` are untouched.

```diff
 // src/editor/module.ts
-export interface ModuleContext {
-  readonly doc: SpriteDocument;
-  readonly history: History;
-  dispatch(factory: () => Command | null): boolean;
-  navigate(to: string): void;
-  showHelp(): void;
-  save(): Promise<void>;
-  forTool(toolId: ToolId): ToolHost;
-}
+export interface ModuleContext extends SessionContext {
+  readonly doc: SpriteDocument;
+  dispatch(factory: () => Command | null): boolean;
+  forTool(toolId: ToolId): ToolHost;
+}

-export interface ModuleCommand<Id extends string = string> {
-  …the whole shape
-}
+export type ModuleCommand<Id extends string = string> = CommandSpec<Id, ModuleContext>;

-export function defineCommands<const Id extends string>(…) { return commands; }
+export const defineCommands = commandsFor<ModuleContext>();

-export function bindCommands(…) { … }
+export { bindCommands } from "@/commands/define";
```

```diff
-// src/editor/shell/commands.ts — deleted (SHELL_COMMANDS moved to session.ts)

 // src/editor/shell/module.ts
-import { SHELL_COMMANDS } from "./commands";
+import { SESSION_COMMANDS } from "@/commands/session";
 …
-  commands: SHELL_COMMANDS,
+  commands: SESSION_COMMANDS,
```

The builder declares its commands instead of hand-writing a registry.

```diff
+// src/commands/builderCommands.ts
+export interface BuilderContext extends SessionContext {
+  /** The packed sheet, in sprite px: what "fit to window" fits. */
+  readonly sheet: Size;
+}
+
+const view = () => useBuilderViewStore.getState();
+
+export const BUILDER_COMMANDS = commandsFor<BuilderContext>()([
+  ...SESSION_COMMANDS,
+  { id: "view.zoomIn",  …, keys: SHARED_KEYS["view.zoomIn"],  run: () => view().zoomBy(1) },
+  { id: "view.zoomOut", …, keys: SHARED_KEYS["view.zoomOut"], run: () => view().zoomBy(-1) },
+  { id: "view.fit",     …, keys: SHARED_KEYS["view.fit"],     run: ({ sheet }) => view().fit(sheet) },
+  { id: "view.toggleGrid", label: "Toggle grid", …, keys: SHARED_KEYS["view.toggleGrid"] },
+]);
+
+export type BuilderCommandId = (typeof BUILDER_COMMANDS)[number]["id"];
```

```diff
 // src/commands/useBuilderCommands.ts — signature unchanged
 export function useBuilderCommands(sheet: Size, onHelp: () => void): CommandRegistry {
   const { history, autosave } = useSpritesheetSession();
   const navigate = useNavigate();
-  const store = useBuilderViewStore;
-
-  return {
-    "edit.undo": { id: "edit.undo", label: "Undo", …, run: () => history.undo() },
-    "edit.redo": { … },
-    …80 lines, 9 entries
-  };
+  return bindCommands(BUILDER_COMMANDS, {
+    history,
+    sheet,
+    navigate: (to) => void navigate(to),
+    showHelp: onHelp,
+    save: () => autosave.flush(),
+  });
 }
```

The id union and the shared keys.

```diff
 // src/commands/types.ts
+import type { BuilderCommandId } from "@/commands/builderCommands";
 …
-export type CommandId = ToolCommandId | ContributedCommandId | SettingCommandId | ModuleCommandId;
+export type CommandId =
+  | ToolCommandId
+  | ContributedCommandId
+  | SettingCommandId
+  | ModuleCommandId
+  | BuilderCommandId;
```

```diff
 // src/constants/shortcuts.ts
-/** The commands both the pixel editor and the spritesheet composer offer, under the same ids. */
-export type SharedCommandId =
-  | "edit.undo" | "edit.redo" | "edit.save"
-  | "view.zoomIn" | "view.zoomOut" | "view.fit" | "view.toggleGrid"
-  | "app.shortcutHelp" | "app.backToLibrary";
+/** The view commands both surfaces declare separately, over their own view stores. */
+export type SharedViewCommandId = "view.zoomIn" | "view.zoomOut" | "view.fit" | "view.toggleGrid";

-export const SHARED_KEYS: Readonly<Record<SharedCommandId, readonly KeyBinding[]>> = {
-  "edit.undo": [{ key: "z", mod: true }],
-  "edit.redo": [{ key: "z", mod: true, shift: true }, { key: "y", mod: true }],
-  "edit.save": [{ key: "s", mod: true }],
+export const SHARED_KEYS: Readonly<Record<SharedViewCommandId, readonly KeyBinding[]>> = {
   "view.zoomIn": [{ key: "+" }, { key: "=" }],
   "view.zoomOut": [{ key: "-" }, { key: "_" }],
   "view.fit": [{ key: "0" }],
   "view.toggleGrid": [{ key: "g", mod: true }],
-  "app.shortcutHelp": [{ key: "?" }],
-  "app.backToLibrary": [{ key: "escape", shift: true }],
 };
```

```diff
 // tests/browser/commands/useBuilderCommands.browser.test.tsx
-test("the composer's commands take their keys from SHARED_KEYS, as the pixel editor's do", …
-  expect(Object.keys(registry).sort()).toEqual(Object.keys(SHARED_KEYS).sort());
+test("the composer binds BUILDER_COMMANDS in order, sharing the session commands' keys", …
+  expect(Object.keys(registry)).toEqual(BUILDER_COMMANDS.map(({ id }) => id));
+  for (const command of SESSION_COMMANDS) expect(registry[command.id]?.keys).toBe(command.keys);
```

## Test approach
- Builder browser test: drop the id-set == `SHARED_KEYS` assertion; assert the builder registry's ids equal
  `BUILDER_COMMANDS` ids in order, session commands carry the same definition keys as the editor's, and the
  4 view commands use `SHARED_KEYS`. Keep the no-duplicate-chord test.
- Existing editor registry/keymap tests unchanged and green.
- Commands: `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:browser`.

## Done when
- [x] Done1: `grep -rn "@/editor" src/commands/define.ts src/commands/session.ts src/commands/builderCommands.ts src/commands/useBuilderCommands.ts` returns nothing.
- [x] Done2: The five session command definitions exist once (`grep -rn '"edit.undo"' src --include=*.ts` hits only `src/commands/session.ts`).
- [x] Done3: `CommandId` includes `BuilderCommandId`; adding a `sheet.x` definition to `BUILDER_COMMANDS` type-checks without touching any editor file.
- [x] Done4: `SHARED_KEYS` has exactly the 4 view ids.
- [x] Done5: Editor and builder registries have the same ids, labels, keys and order as before (tests).
- [x] Done6: lint, build, unit and browser tests pass.
- [x] Done7: `docs/architecture.md` command section describes session commands and builder definitions.

## Open risks
- O1: `CommandSpec` method params under `strictFunctionTypes`: `SESSION_COMMANDS` (Ctx = SessionContext) must
  be assignable where `ModuleCommand` is expected. Method syntax is bivariant, so expected fine.

## Tasks
- [x] `src/commands/define.ts` — generic spec, `commandsFor`, `bindCommands` → Done1, Done3
- [x] `src/commands/session.ts` — `SessionContext`, `SESSION_COMMANDS` → Done2
- [x] `src/editor/module.ts` — `ModuleContext extends SessionContext`, aliases → Done1
- [x] `src/editor/shell/commands.ts`, `src/editor/shell/module.ts` — use `SESSION_COMMANDS` → Done2
- [x] `src/commands/builderCommands.ts` — `BuilderContext`, `BUILDER_COMMANDS` → Done3
- [x] `src/commands/useBuilderCommands.ts` — build context, bind → Done5
- [x] `src/commands/types.ts` — add `BuilderCommandId` → Done3
- [x] `src/constants/shortcuts.ts` — shrink `SHARED_KEYS` → Done4
- [x] `tests/browser/commands/useBuilderCommands.browser.test.tsx` — updated assertions → Done5
- [x] `docs/architecture.md` — command section → Done7

## Drift log
- Tasks → also updated `tests/unit/editor/modules.test.ts`, `tests/browser/components/CommandButton.browser.test.tsx`,
  `tests/browser/hooks/useShortcuts.browser.test.tsx` (they read `SHARED_KEYS["edit.*"]`, removed by D2; they now read
  `SESSION_COMMANDS`), and `docs/shortcuts.md` plus `.claude/skills/review-contribution/SKILL.md` (both described
  `SHARED_KEYS` as holding the session keys).
- Done2 check → the grep for `"edit.undo"` also matches the two `CommandButton` usages; the definition check is
  `grep -rn 'id: "edit.undo"' src`, which hits only `src/commands/session.ts`.
- Done5 "same order" → the builder registry now lists the session commands first (`...SESSION_COMMANDS`), then
  the view commands; before, help and back came last. Not visible: the cheat sheet groups by `COMMAND_GROUPS`
  and order within each group is unchanged, and the builder binds no chord twice.
