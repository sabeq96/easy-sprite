# Modules 5/5: the pixel editor's host is split into domain modules

Status: approved (2026-10-01)
Date: 2026-10-01
Depends on: [4 painters](2026-10-01-modules-4-renderer-painters.md) merged
Series: [0 core](2026-10-01-modules-0-core-rename.md) · [1 tool folders](2026-10-01-modules-1-tool-folders.md) · [2 tool interfaces](2026-10-01-modules-2-tool-interfaces.md) · [3 settings](2026-10-01-modules-3-settings.md) · [4 painters](2026-10-01-modules-4-renderer-painters.md) · [5 host modules](2026-10-01-modules-5-host-modules.md)

## Context

Read "Why this series exists" in [stage 0](2026-10-01-modules-0-core-rename.md) first.

The pixel editor's host is organised by technical layer:

- 28 files in `components/editor/`;
- most of the 33 hooks in `hooks/`;
- `commands/useEditorCommands.ts`, 336 lines that cover every domain;
- one `useEditorStore` built from view, tool, color and settings slices.

Understanding "frames" means reading five folders. This stage regroups the host by domain.
Each module owns its UI, its store, its commands and hints, its canvas painters, and the
capabilities it provides to tools.

## Goal

`src/editor/<domain>/` holds eight host modules:

| Module | Owns (moved in) | Store | Commands | Provides |
|---|---|---|---|---|
| `shell` | `EditorPage`, `EditorTopBar`, `EditorMenu`, `EditorStatusBar`, `EditorSkeleton`, `EditorLoadError`, `RightSidebar`, `SpriteNameField`, `ShortcutHelpDialog`, `ResizeCanvasDialog`; the module list | (none) | `edit.undo`, `edit.redo`, `edit.save`, `app.shortcutHelp`, `app.backToLibrary` | `ToolHost.history` adapter |
| `palette` | `PalettePanel`, `PaletteMenu`, `ActiveColors`, `usePalettes`, `usePaletteActions`, `useColorUsage`, `useColorHotkeys` | primary, secondary, active palette | `color.swap`, `color.reset` | `ToolHost.colors` adapter, 1–9 hints |
| `layers` | `LayersPanel`, `LayerRow`, `LayerThumbnail`, `LayerOpacityControl` | active layer | `layer.*` | active layer for the canvas |
| `frames` | `FramesBar`, `FrameCard`, `FrameThumbnail` | active frame | `frame.*` | active frame for the canvas and animation |
| `animation` | `PreviewPanel`, `useAnimationPlayer`, `OnionSkinControl` | onion config, playing | `view.toggleOnion` | onion painter |
| `view` | `ViewControls`, `CheckerboardLayer`, `useGridDefaults` (as the grid reset) | viewport, container size, grid, chessboard | `view.zoomIn`, `view.zoomOut`, `view.fit`, `view.toggleGrid` | grid painter, viewport for the canvas |
| `toolbox` | `ToolSidebar`, `ToolOptionsBar`, `toolCommands`, `contributed`, `useToolSettings` | active tool, held tool, tool settings | `tool.<id>`, tool-contributed and setting-generated commands | `ToolHost.tool` adapter |
| `canvas` | `EditorCanvas`, `useCanvasRenderer`, `usePointerPaint`, `useToolLifecycle`, `useCanvasViewControls`, `useCursorStore`, the `toolHost/` adapters | cursor position | (none) | `ToolHost` assembly, `Surface`, `ToolHost.canvas`/`.document`, pan/zoom hints |

`useEditorStore`, `useEditorCommands`, `src/components/editor/`, the editor-only hooks, and
`FEATURE_HINTS` are gone afterwards.

## Non-goals

- The builder, library (`manager`), settings pages and their stores keep today's layout.
- Shared infrastructure stays put:
  - hooks: `useDnd`, `useDocumentSnapshot`, `useDocumentRevision`, `useCommandDispatch`, `useShortcuts`, `useThumbnailCanvas`, `useAsyncAction`, `useSpriteActions`, `useHistoryState`, `useOptimisticOrder`;
  - commands: `commands/{CommandsContext,hints,keymap,types}`;
  - and `components/{ui,common}`.
- No behaviour or UI change. No UI slot system: the shell lays out panels in plain JSX.
- No persistence.

## Decisions

| # | Decision | Why | Rejected alternative |
|---|----------|-----|----------------------|
| 1 | **Settled by the maintainer.** The host is split by domain under `src/editor/<domain>/` (the core became `src/core/` in stage 0) | One place per domain. Names match meaning | `src/host/`. `src/features/` |
| 2 | **Settled by the maintainer.** Each module has **its own zustand store** (`store.ts`), and nothing composes them | A module can be read, tested and removed without a central store file | Slices composed into one store |
| 3 | **Settled by the maintainer.** Each module has one **public face, `api.ts`**. Other modules import only that. Lint bans deep imports into another module | Coupling between modules is visible in one file per module | Free imports. Talking only through interfaces (too heavy for code that ships together) |
| 4 | **Settled by the maintainer.** Commands, hints and canvas painters reach the shell and canvas through a static list, `EDITOR_MODULES`. Layout stays plain JSX in the shell | The same contribution style as tools, with no slot framework | Wiring every module by hand. UI slots |
| 5 | **Settled by the maintainer.** The pixel editor only | Contains the move to about 70 files | The whole app |
| 6 | `EditorModule = { id; commands?(ctx): CommandRegistry; hints?: HintSection[]; attachCanvas?(renderer, doc): () => void }`. The `ctx` holds `doc`, `history`, `dispatch`, `navigate` and `showHelp`. `commands` is a plain function, not a hook, so modules can be tested without React | Pure and testable. Hooks in a loop would break the rules of hooks | Each module exporting a `useCommands` hook |
| 7 | `canvas` calls each module's `attachCanvas` in `EDITOR_MODULES` order when the renderer is created, before any tool activates. `view` attaches the grid painter and `animation` the onion painter, and each subscribes to its own store to invalidate | Painters stay with the state they draw. Stacking is grid, then the tool overlay (stage 4, Decision 3) | Registering every painter centrally in `canvas` |
| 8 | `api.ts` is a deliberate public face, the second kind of allowed barrel besides registries. It exports only what other modules use (components the shell places, store hooks or selectors, `module`) | Conventions §5 bans barrels because they re-export everything. `api.ts` exports by choice | `index.ts` re-exporting the folder |
| 9 | The `ToolHost` is assembled in `canvas/toolHost/` from adapters each module exports through `api.ts`: `palette` → `colors`, `shell` → `history`, `toolbox` → `tool`, and `canvas` itself → `canvas`, `document` and `Surface` | The module that owns the state implements the capability. Tools still see only `framework/host.ts` | One big adapter file reading every store |
| 10 | **Lint** for `src/editor/*/**`:<br>• No `@/editor/*/*` except `@/editor/*/api`, `@/editor/module` and `@/editor/modules`.<br>• No `../*`.<br>• No `@/db/db` or `dexie*`.<br>• No `@/tools/*` except `@/tools/index`.<br>• In `*.tsx` files: no `@/db/*`, `@/services/*` or `@/export/*` (type imports allowed).<br>The `components/` and `hooks/` overrides stay for the shared folders | Module isolation is checked. "Components reach data through hooks" survives inside mixed folders through the `.tsx` rule | Dropping the layer rules |
| 11 | One PR per task, in the order below. Each task moves one module, moves its commands out of `useEditorCommands` into `commands.ts`, adds it to `EDITOR_MODULES`, and leaves everything green | Each PR is reviewable and can be bisected. `useEditorCommands` shrinks to nothing | One big-bang PR |
| 12 | Store and hook tests move with their module: `tests/unit/stores/*` become `tests/unit/editor/<module>/store.test.ts`. `tests/browser/editor/*` stays, because it tests the UI from outside | Mirrors `src/` | — |

## Layout after this stage

```text
src/editor/
  module.ts            EditorModule, ModuleContext
  modules.ts           EDITOR_MODULES = [shell, palette, layers, frames, animation, view, toolbox, canvas] (static list)
  shell/      api.ts  EditorPage.tsx  EditorTopBar.tsx  …  commands.ts  historyAdapter.ts
  palette/    api.ts  store.ts  PalettePanel.tsx  …  usePalettes.ts  useColorHotkeys.ts  commands.ts  colorsAdapter.ts
  layers/     api.ts  store.ts  LayersPanel.tsx  …  commands.ts
  frames/     api.ts  store.ts  FramesBar.tsx  …  commands.ts
  animation/  api.ts  store.ts  PreviewPanel.tsx  OnionSkinControl.tsx  useAnimationPlayer.ts  commands.ts  attachCanvas.ts
  view/       api.ts  store.ts  ViewControls.tsx  CheckerboardLayer.tsx  useGridReset.ts  commands.ts  attachCanvas.ts
  toolbox/    api.ts  store.ts  ToolSidebar.tsx  ToolOptionsBar.tsx  toolCommands.ts  contributed.ts  useToolSettings.ts  toolAdapter.ts
  canvas/     api.ts  store.ts  EditorCanvas.tsx  useCanvasRenderer.ts  usePointerPaint.ts  useToolLifecycle.ts  useCanvasViewControls.ts  toolHost/
```

## Interfaces

```ts
// src/editor/module.ts
export interface ModuleContext {
  readonly doc: SpriteDocument;
  readonly history: History;
  dispatch(factory: () => Command | null): boolean;
  navigate(to: string): void;
  showHelp(): void;
}
export interface EditorModule {
  readonly id: string;
  /** Plain function: called per render by the shell; closures read stores lazily. */
  commands?(ctx: ModuleContext): CommandRegistry;
  readonly hints?: readonly HintSection[];
  /** Registers painters or listeners on the renderer; the cleanup runs when it is disposed. */
  attachCanvas?(renderer: CanvasRenderer, doc: SpriteDocument): () => void;
}

// src/editor/modules.ts
export const EDITOR_MODULES: readonly EditorModule[];

// example: src/editor/frames/api.ts
export { FramesBar } from "./FramesBar";
export { useFramesStore, activeFrameId } from "./store";   // activeFrameId(doc): string, falling back to the first frame
export { framesModule as module } from "./module";
```

Shell after (sketch):

```tsx
function EditorShell() {
  const ctx = useModuleContext(showHelp);
  const commands = mergeCommands([...EDITOR_MODULES.map((m) => m.commands?.(ctx) ?? {}), toolCommands]);
  useShortcuts(commands);
  return (
    <CommandsProvider value={commands}>
      {/* plain JSX layout from palette/api, layers/api, frames/api, … */}
    </CommandsProvider>
  );
}
```

## Tasks (one PR each, in order)

1. ✅ **shell + mechanism.**
   - Add `module.ts` and `modules.ts`.
   - Move the shell files, and move undo, redo, save, help and back into `shell/commands.ts`.
   - `EditorPage` merges `EDITOR_MODULES` commands with what's left of `useEditorCommands`.
   - The cheat sheet reads hints from `EDITOR_MODULES` and `TOOL_LIST`, and `FEATURE_HINTS` is deleted.
   - The `history` adapter moves here.
   - Add the lint override (Decision 10).
2. ✅ **palette.**
   - `colorSlice` → `palette/store.ts`.
   - Move the components and hooks, and the color commands.
   - `COLOR_HOTKEY_HINTS` → `module.hints`.
   - The `colors` adapter moves here.
3. ✅ **layers.** `activeLayerId` → `layers/store.ts`. Move the components and the layer commands, and the layer half of `useActiveTargets`.
4. ✅ **frames.** `activeFrameId` → `frames/store.ts`. Move the components and the frame commands, and the frame half of `useActiveTargets` (then delete `useActiveTargets`).
5. ✅ **animation.**
   - `onion` and `isPlaying` → `animation/store.ts`.
   - Move `PreviewPanel`, the player and `OnionSkinControl`.
   - `view.toggleOnion` → `animation/commands.ts`.
   - `attachCanvas` registers the onion painter, moved from `useCanvasRenderer`.
6. **view.**
   - The rest of `viewSlice` → `view/store.ts`.
   - Move `ViewControls`, `CheckerboardLayer` and `useGridDefaults` (renamed `useGridReset`).
   - Zoom, fit and grid commands.
   - `attachCanvas` registers the grid painter.
7. **toolbox.**
   - `toolSlice` + `settingsSlice` → `toolbox/store.ts`.
   - Move `ToolSidebar`, `ToolOptionsBar`, `toolCommands`, `contributed` and `useToolSettings`, and move the `tool` adapter.
   - Tool commands join through `toolbox`'s `module.commands`.
8. **canvas + cleanup.**
   - Move `EditorCanvas`, the renderer, pointer, lifecycle and pan/zoom hooks, `useCursorStore` and `toolHost/`.
   - `CANVAS_VIEW_HINTS` and `POINTER_PAINT_HINTS` → `module.hints`.
   - Delete `useEditorStore`, `stores/slices/`, `useEditorCommands` and `src/components/editor/`.
   - Docs.

## Files

Per task, as listed. In addition:

- `.oxlintrc.json`: Decision 10 (task 1).
- `tests/support/*`: helpers that reset `useEditorStore` reset every module store (one `resetEditorStores()` that iterates the module stores through their `api.ts`).
- `docs/architecture.md` (task 8):
  - §1 diagram: the stores become module stores.
  - §2 folder map: core, framework, tools, editor modules, shared.
  - §9 boundaries table.
  - New §11 "Modules": the three kinds of code (core, host modules that provide, tools that consume), `api.ts`, `EDITOR_MODULES` and `ToolHost`.
- `docs/conventions.md`:
  - §1: "where does this go" adds "belongs to one editor domain → `src/editor/<domain>/`".
  - §5: `api.ts`.
  - §10: lint.
- `docs/README.md` decision log, two new rows:
  - "Host split by domain modules with one store each" (revisit if: cross-module `api.ts` imports outnumber in-module ones);
  - "Tools consume the host only through `framework/host.ts`; no separate 'features' category" (revisit if: a third optional, always-on canvas capability is requested).
- `.claude/skills/review-contribution/SKILL.md`: "a new editor capability goes in its domain module; a new tool goes in `src/tools/`".

## Test plan

- Each task: the moved unit tests are green at their new paths, and every browser suite is green and unchanged. Browser tests already drive the UI, so they shouldn't need edits beyond store-reset helpers.
- Task 1: new `tests/unit/editor/modules.test.ts`:
  - module ids are unique;
  - no two modules (plus tools) register the same command id;
  - the merged `SHORTCUTS` has no duplicate chord.
- Task 5 and task 6: unit tests that `attachCanvas` adds exactly one painter on the right channel and removes it on cleanup (fake renderer).
- Task 8: `grep` checks from Done when.

Command per PR: `npm run lint && npm run build && npm run test:coverage`

## Done when

- [ ] 1. `src/components/editor/`, `src/stores/slices/`, `useEditorStore`, `useEditorCommands`, `FEATURE_HINTS` and `useActiveTargets` no longer exist.
- [ ] 2. Every file of the pixel editor's host is under `src/editor/<domain>/`, and every cross-module import goes through `api.ts` (lint probe: `import "@/editor/frames/store"` from `src/editor/layers/LayersPanel.tsx` fails).
- [ ] 3. Adding a command to a domain touches only that module's `commands.ts`.
- [ ] 4. The cheat sheet, menus, tooltips and every key are identical to before.
- [ ] 5. The builder and library are untouched, and their tests pass.
- [ ] 6. Docs and the decision log describe the three kinds of code.
- [ ] 7. The command passes on every PR.

## Open risks

- **oxlint globs (found in stage 1):** a `*` in a `no-restricted-imports` group does not cross `/`. Write every pattern in this contract with `/**` (`@/tools/**`, `@/editor/*/**`, `../**`), keep `!` negations, and prove each rule with a lint probe.
- Cross-module reads in render paths (layers reading the active frame, for example) must still
  use selector hooks from `api.ts`, not `getState()` in render. The React Compiler trap in
  conventions §6c still applies.
- Several browser tests may set `useEditorStore` directly (against conventions §11). Each one
  found is rewritten to drive the UI, or to use the owning module's `api.ts`. List them in the drift log.
- If `api.ts` files grow into "export everything", Decision 3 has failed quietly. Review every
  `api.ts` addition as an interface change.

## Open questions for the maintainer

None. Decisions 1-5 were settled on 2026-10-01.

## Drift log

- **2026-10-01, Task 1: `shell/api.ts` does not export `EditorPage`; the router imports `@/editor/shell/EditorPage`.**
  Exported from `api.ts`, it closed two import cycles that `import/no-cycle` rejects:
  `modules.ts → shell/api → EditorPage → modules.ts`, and
  `createToolHost → shell/api → EditorPage → createToolHost`. No other module places the page, so
  Decision 8 ("exports only what other modules use") already leaves it out. `src/app/` is not a
  module, and Decision 10's lint does not cover it. Consequence for every later task: nothing
  `EditorPage` reaches (`modules.ts`, every module's `api.ts`, `canvas/toolHost/`) may import a
  shell file that imports `EditorPage` or `modules.ts`. `shell/api.ts` exports
  `createHistoryAdapter` and `module` only.
- **2026-10-01, Task 1: `ModuleContext.save(): Promise<void>`.** It is not in the Interfaces
  sketch. `edit.save` flushes the autosave, and the sketched context had no way to reach it.
  `useModuleContext` binds it to `autosave.flush()`; the "Saved" toast stays in `shell/commands.ts`.
- **2026-10-01, Task 1: interim hints on the shell module.** The cheat sheet reads
  `EDITOR_MODULES.flatMap(hints)`, so until palette and canvas exist, `shellModule.hints` holds
  `COLOR_HOTKEY_HINTS`, `POINTER_PAINT_HINTS` and `CANVAS_VIEW_HINTS` (imported from `hooks/`),
  in the order `FEATURE_HINTS` had. Palette (task 2) and canvas (task 8) take them. Watch the
  row order: hint rows in one group follow module order, and `COLOR_HOTKEY_HINTS` and
  `POINTER_PAINT_HINTS` are both in "Color". If task 2 puts the colour keys on palette (after
  shell) while the pointer hint stays on shell, "Paint with secondary color" moves above
  "Pick primary".
- **2026-10-01, Task 1: shell wiring.** `shell/useModuleContext.ts` builds the context from the
  document session, `useCommandDispatch` and `useNavigate`. `EditorShell` merges
  `EDITOR_MODULES` commands, then `useEditorCommands()` (later keys win, but the unit test
  forbids overlaps), through a local `mergeCommands`. The `withHelp` `useMemo` is gone:
  `app.shortcutHelp` is a shell command that calls `ctx.showHelp`.
- **2026-10-01, Task 1: the `history` adapter is `createHistoryAdapter(doc, history): Edits` in
  `shell/historyAdapter.ts`.** `createToolHost` keeps its `{ doc, history }` signature and
  imports the adapter through `@/editor/shell/api`, so no test changed. The adapter has its own
  three-line `activeTarget()` (the tool host keeps one for `crop`). Both read `useEditorStore`
  until layers and frames (tasks 3–4) expose their selectors. `docs/architecture.md` still says
  "the adapters live in `src/hooks/toolHost/`" (task 8 rewrites that section).
- **2026-10-01, Task 1: lint (Decision 10).** Two overrides, because a later override replaces
  `no-restricted-imports`. `src/editor/*/**` has four groups:
  - `@/editor/*/**` except `@/editor/*/api`, `@/editor/module` and `@/editor/modules`;
  - `../**`;
  - `@/db/db` and `dexie*`;
  - `@/tools/**` except `@/tools/index`.

  `src/editor/*/**/*.tsx` repeats those four and adds `@/db/**`, `@/services/**` and
  `@/export/**` with `allowTypeImports`. That is `/**` where Decision 10 wrote `/*`, so nested
  paths such as `@/db/repositories/sprites` are caught. Probes ran with a throwaway
  `src/editor/zzprobe/` module and shell files, then were deleted.
  - Rejected from `shell/*.ts`: `@/editor/zzprobe/store` (deep cross-module), `../zzprobe/api`,
    `@/db/db`, `dexie`, `dexie-react-hooks`, `@/tools/pencil/tool`.
  - Passed from `shell/*.ts`: `@/editor/zzprobe/api`, `@/editor/module`, `@/editor/modules`,
    `./commands`, `@/db/repositories/sprites`, `@/services/autosave`, `@/tools`, `@/tools/index`.
  - Rejected from `zzprobe/Probe.tsx`: `@/editor/shell/commands`, `../shell/api`,
    `@/services/autosave`, `@/db/repositories/sprites`, `@/export/spritePng`,
    `@/tools/pencil/tool`, `dexie`.
  - Passed from `zzprobe/Probe.tsx`: `import type … from "@/services/autosave"` and
    `@/editor/shell/api`.
  - From `zzprobe/sub/Deep.tsx`, both `@/services/autosave` and `@/editor/shell/commands` are
    rejected.
  - `src/editor/module.ts` and `modules.ts` are not matched by `src/editor/*/**`; a deep import
    there passes. This is the same as `src/tools/index.ts` under `src/tools/*/**`.
- **2026-10-01, Task 1: verification beyond the suites.** A throwaway browser probe, run on this
  tree and on `ed1e036` in a scratch worktree (then deleted), dumped the editor's buttons
  (accessible name, `aria-keyshortcuts`, disabled), the tooltips of six buttons, the whole cheat
  sheet text and the sprite menu text. The results are identical, except that one run caught the
  previous tooltip still fading out next to the new one; every tooltip's text matches.
- **2026-10-01, Task 1: tests.** New `tests/unit/editor/modules.test.ts`, covering the three
  planned cases. The duplicate-chord case repeats the check in `keymap.test.ts`, because modules
  declare no keys yet. Mutation probe: a `tool.pencil` entry added to `shellCommands` fails "never
  registers one command id twice" with `["tool.pencil"]`; restored from a copy. No existing test
  changed.
- **2026-10-01, Task 2: `EDITOR_MODULES` is `[palette, shell]` for now, not `[shell, palette]`.**
  Hint rows follow module order, and shell still holds `POINTER_PAINT_HINTS` ("Paint with
  secondary color", group "Color"). With shell first, that row would move above "Pick primary".
  `modules.ts` says why in a comment. Task 8 restores the Layout order (shell first) when canvas
  takes the shell's hints. Commands are unaffected (no overlapping ids), and no module attaches
  painters yet.
- **2026-10-01, Task 2: `usePalettes` keeps `useLiveQuery` behind one disable comment.**
  Decision 10's `dexie*` group also matches `dexie-react-hooks`, so the moved hook failed lint
  ("Editor modules read the database through src/db/repositories/, never the raw Dexie
  instance"). The hook still reads through `listPalettes()` in the repository; only the live
  subscription comes from `dexie-react-hooks`, which `src/hooks/**` allows. The import carries
  `// eslint-disable-next-line no-restricted-imports -- …` instead of a change to the rule.
  Probe: without the comment, `npx oxlint src/editor/palette` reports
  `'dexie-react-hooks' import is restricted`. Narrowing the group to `dexie` (as in `hooks/`) is
  a maintainer call; see the task 2 report.
- **2026-10-01, Task 2: the store is `usePaletteStore` (`PaletteState`), with the slice's fields and
  actions unchanged.** `EditorStore` loses `ColorSlice`; `createTestStore()` loses the colour
  slice. `palette/api.ts` exports `PalettePanel`, `useColorHotkeys`, `usePaletteStore`,
  `createColorsAdapter` and `module`. No file in `src/` outside palette uses `usePaletteStore`;
  only tests do (`resetEditorStores()` and colour setup in browser tests). `ActiveColors`,
  `PaletteMenu`, `usePalettes`, `usePaletteActions` and `useColorUsage` stay private.
  `COLOR_HOTKEY_HINTS` stays in `useColorHotkeys.ts`, and the palette's 1–9 tooltip still reads it.
- **2026-10-01, Task 2: `color.swap` and `color.reset` are `paletteCommands()` in
  `palette/commands.ts`.** They take no context, because they only touch the palette store.
  `useEditorCommands` loses both.
- **2026-10-01, Task 2: the `colors` adapter is `createColorsAdapter(): Colors` in
  `palette/colorsAdapter.ts`.** `createToolHost` imports it through `@/editor/palette/api`. No
  cycle: nothing palette reaches imports `createToolHost`, `EditorPage` or `modules.ts`.
- **2026-10-01, Task 2: unit setup stubs `ResizeObserver`.** `createToolHost` (and
  `tests/support/store.ts`) now load `palette/api.ts`, which loads `PalettePanel`, and
  `@dnd-kit/react/sortable` builds a `ResizeObserver` when it loads. jsdom has none, so eight unit
  files failed to import. `tests/support/setup.unit.ts` adds a no-op stub next to its
  `OffscreenCanvas` and `ImageData` stubs.
- **2026-10-01, Task 2: tests.**
  - `tests/unit/stores/colorSlice.test.ts` became `tests/unit/editor/palette/store.test.ts`. It
    tests the singleton after `resetEditorStores()` instead of a `createTestStore()` instance.
    Same two cases, same expected values.
  - `resetEditorStores()` is in `tests/support/store.ts`. It resets `useEditorStore` and
    `usePaletteStore` with `setState(getInitialState(), true)`. `useCursorStore` and
    `useBuilderViewStore` keep their own reset lines in `setup.browser.ts` until their tasks.
  - Resets moved to `resetEditorStores()`: `setup.browser.ts` (after each test),
    `tests/unit/tools/select.test.ts` and `tests/unit/commands/contributed.test.ts`. The two unit
    files then set their fields with a partial `setState`.
  - Setup that set colours or the active palette on `useEditorStore` now uses
    `usePaletteStore` from `@/editor/palette/api`: `frames`, `layers`, `palette`
    (`editor/`), `core-editing`, `dnd-visuals` (`flows/`), and `fill`, `pencil`, `picker`,
    `select`, `tool-matrix` (`tools/`), plus `activeColors()` in `tests/support/editor.ts`.
  - One assertion changed its store and nothing else: `palette.browser.test.tsx` polls
    `usePaletteStore.getState().activePaletteId` instead of `useEditorStore`'s, with the same
    expected value.
- **2026-10-01, Task 2: verification beyond the suites.** The task 1 browser probe ran again on
  this tree and on `8beb05c` in a scratch worktree (then removed). It dumped the editor's buttons
  (name, `aria-keyshortcuts`, disabled), the X and D results, the swap button's tooltip, the
  whole cheat sheet and the palette menu. All five dumps are identical. The Color group reads
  "Swap colors X, Reset colors D, Pick primary 1–9, Pick secondary ⇧ + 1–9, Paint with secondary
  color Right-drag". `docs/architecture.md` still names `usePaletteActions` and `usePalettes`
  as hooks; task 8 rewrites the docs.

- **2026-10-01, Task 3: the store is `useLayersStore` (`LayersState`): `activeLayerId` and
  `setActiveLayer`, unchanged from `viewSlice`, which loses both.** `layers/api.ts` exports
  `LayersPanel` (shell's `RightSidebar`), `useLayersStore`, `useActiveLayerGuard` (shell's
  `EditorShell`) and `module`. `LayerRow`, `LayerThumbnail`, `LayerOpacityControl`,
  `commands.ts` and `store.ts` stay private. No selector helper (like the sketched
  `activeFrameId(doc)`) was added: every reader keeps its own fallback, so behaviour is unchanged.
  Readers outside the module, all through `@/editor/layers/api`: `shell/EditorStatusBar`
  (selector hook), `shell/historyAdapter` and `hooks/toolHost/createToolHost` (`activeTarget()`,
  `getState()`), and `hooks/usePointerPaint` (`resolveTarget`, `getState()`; this is the
  surface's target). The two `activeTarget()` copies now read the layer from `useLayersStore`
  and the frame from `useEditorStore`.
- **2026-10-01, Task 3: `layer.add`, `layer.duplicate`, `layer.delete`, `layer.mergeDown`,
  `layer.selectAbove` and `layer.selectBelow` are `layerCommands(ctx)` in `layers/commands.ts`.**
  They use `ctx.doc` and `ctx.dispatch`, with the same labels, groups, `isEnabled` and bodies.
  `useEditorCommands` loses them, its `stepLayer` and the `core/commands/layers` import. In the
  merged registry the layer ids now come before `tool.*`; nothing visible reads registry order
  for them (the sheet orders groups and rows by `SHORTCUTS`, and `toolsGroupCommands` only
  keeps Tools-group ids).
- **2026-10-01, Task 3: `useActiveTargets` keeps only the frame half and now returns `void`.**
  Its `ActiveTargets` return value (`{ layerId, frameId }`) had no reader; keeping `layerId`
  would have made `hooks/` read the layers store for nothing. `useActiveLayerGuard()` in
  `layers/useActiveLayerGuard.ts` holds the layer half (same effect, same topmost-layer
  default). `EditorShell` calls `useActiveLayerGuard()` then `useActiveTargets()`, the order the
  one effect used to run them in.
- **2026-10-01, Task 3: `EDITOR_MODULES` is `[palette, shell, layers]`.** Layers declares no
  hints and no painters, so only commands join.
- **2026-10-01, Task 3: tests.**
  - The "tracks the active frame and layer" case in `tests/unit/stores/viewSlice.test.ts` was
    split: the frame half stays there as "tracks the active frame"; the layer half is
    "tracks the active layer" in the new `tests/unit/editor/layers/store.test.ts` (singleton
    after `resetEditorStores()`, same expected value). The unit project goes from 322 to 323 tests.
  - `resetEditorStores()` also resets `useLayersStore`.
  - Setup that set `activeLayerId` on `useEditorStore` now sets it on `useLayersStore` from
    `@/editor/layers/api`: `tests/unit/tools/select.test.ts` and
    `tests/unit/commands/contributed.test.ts` (the frame stays on `useEditorStore`).
  - Reads that changed store and nothing else: in `tests/support/editor.ts`, `openEditor()`'s
    "active layer is not null" poll, `selectLayer()`'s active-name poll and `resolveCel()`'s
    default layer; in `tests/browser/editor/layers.browser.test.tsx`, the `activeLayerName()`
    helper. Every expected value is unchanged.
- **2026-10-01, Task 3: verification beyond the suites.** A throwaway browser probe ran on this
  tree and on `9a0775c` in a scratch worktree (then removed). It dumped all 42 buttons (name,
  `aria-keyshortcuts`, disabled, `aria-pressed`) four times, the Layers panel text and the status
  bar after each of: New layer (button), PgUp, PgUp, PgDn, PgDn, ⌘⇧N, ⌘E, Duplicate layer and
  Delete layer (buttons); the four layer action tooltips; and the whole cheat sheet. The two
  JSON dumps are byte-identical. The Layers group reads "New layer ⌘⇧N, Merge layer down ⌘E,
  Select layer above PgUp, Select layer below PgDn". There is no layer menu or context menu to
  compare. `docs/conventions.md` §1 still uses `<LayersPanel/>` as its `src/components/`
  example; task 8 rewrites §1.

- **2026-10-01, Task 4: the store is `useFramesStore` (`FramesState`): `activeFrameId` and
  `setActiveFrame`, unchanged from `viewSlice`, which loses both.** `frames/api.ts` exports
  `FramesBar` (shell's `EditorShell`), `useFramesStore`, `useActiveFrameGuard` (shell's
  `EditorShell`) and `module`. `FrameCard`, `FrameThumbnail`, `commands.ts` and `store.ts` stay
  private. As in task 3, the sketched `activeFrameId(doc)` selector helper was not added: every
  reader keeps its own fallback (`?? doc.frames[0].id`, `?? doc.frames[0]?.id`, or none), so
  behaviour is unchanged. Readers outside the module, all through `@/editor/frames/api`:
  - `layers/LayersPanel` and `shell/EditorStatusBar` (selector hooks);
  - `shell/historyAdapter` and `hooks/toolHost/createToolHost` (`activeTarget()`, and
    `sampleComposite` in the tool host, both `getState()`);
  - `hooks/usePointerPaint` (`resolveTarget` and `reportCursor`, `getState()`);
  - `hooks/useCanvasRenderer` (the selector for `setState`, and `getState()` for the renderer's
    initial frame, which used to come from the same `useEditorStore.getState()` snapshot as the
    viewport);
  - `components/editor/PreviewPanel` (selector hook).
- **2026-10-01, Task 4: `frame.add`, `frame.duplicate`, `frame.delete`, `frame.previous`,
  `frame.next`, `frame.moveLeft` and `frame.moveRight` are `frameCommands(ctx)` in
  `frames/commands.ts`.** They use `ctx.doc` and `ctx.dispatch`, with the same labels, group,
  `isEnabled` and bodies (the wrap-around `stepFrame` moved with them). `useEditorCommands`
  loses them, `stepFrame`, the `core/commands/frames` import, and its now-unused
  `useCommandDispatch` call and import.
- **2026-10-01, Task 4: `useActiveTargets` is deleted.** `useActiveFrameGuard()` in
  `frames/useActiveFrameGuard.ts` is its frame half, unchanged (same effect, first-frame
  default). `EditorShell` calls `useActiveLayerGuard()` then `useActiveFrameGuard()`, the order
  the two halves ran in before.
- **2026-10-01, Task 4: `EDITOR_MODULES` is `[palette, shell, layers, frames]`.** Frames declares
  no hints and no painters, so only commands join. No import cycle: `LayersPanel` now imports
  `@/editor/frames/api`, and nothing `frames/api.ts` reaches imports `@/editor/layers/api`
  (`npm run lint` with `import/no-cycle` passes).
- **2026-10-01, Task 4: tests.**
  - The "tracks the active frame" case left `tests/unit/stores/viewSlice.test.ts` for the new
    `tests/unit/editor/frames/store.test.ts` (singleton after `resetEditorStores()`, same
    expected value). The unit project stays at 323 tests; the browser project has 274.
  - `resetEditorStores()` also resets `useFramesStore`.
  - Setup that set `activeFrameId` on `useEditorStore` now sets it on `useFramesStore` from
    `@/editor/frames/api`: `tests/unit/tools/select.test.ts` (the `toolId` stays on
    `useEditorStore`) and `tests/unit/commands/contributed.test.ts`.
  - Reads that changed store and nothing else: in `tests/support/editor.ts`, `resolveCel()`'s and
    `compositeAt()`'s default frame; in `tests/browser/editor/frames.browser.test.tsx`, the
    `activeFrameIndex()` helper. Every expected value is unchanged.
- **2026-10-01, Task 4: verification beyond the suites.**
  - Lint probe (Done-when 2): `import "@/editor/frames/store"` added to the top of
    `layers/LayersPanel.tsx` fails `npx oxlint` with `'@/editor/frames/store' import is
    restricted from being used by a pattern`. The file was restored from a copy.
  - A throwaway browser probe ran on this tree and on `2ce81ab` in a scratch worktree (then
    removed). It reads only the DOM and the live document, so the same file runs on both. It
    dumped all 42 buttons (name, `aria-keyshortcuts`, disabled, `aria-pressed`), the frame order,
    the cards' pressed state and actions, and the status bar after each of 16 states: open, New
    frame (button), N, ⇧N, `,`, `,`, `.`, ⌥`,`, ⌥`.`, ⌥`.` (at the end, a no-op), a click on Frame 1,
    `,` (wraps), `.` (wraps), Duplicate frame on card 2, Delete frame on card 1, and undo. It also
    dumped the three frame tooltips ("New frame N", "Duplicate frame ⇧N", "Delete frame") and
    the whole cheat sheet. The two JSON dumps are byte-identical. The Frames group reads "New
    frame N, Duplicate frame ⇧N, Previous frame `,`, Next frame `.`, Move frame left ⌥`,`, Move
    frame right ⌥`.`". There is no frame menu or context menu to compare.

- **2026-10-01, Task 5: the store is `useAnimationStore` (`AnimationState`): `onion`, `isPlaying`,
  `setOnion` and `setPlaying`, unchanged from `viewSlice`, which loses all four and the
  `OnionConfig` type (now in `animation/store.ts`, not exported from `api.ts`: no other module
  names it).** `animation/api.ts` exports `OnionSkinControl` (`components/editor/ViewControls`),
  `PreviewPanel` (shell's `RightSidebar`), `useAnimationStore` and `module`. `commands.ts`,
  `attachCanvas.ts`, `store.ts` and `useAnimationPlayer.ts` stay private. Readers outside the
  module, all through `@/editor/animation/api`: `hooks/useCanvasRenderer` (the `isPlaying`
  selector for `setState`; the renderer's initial `isPlaying: false` literal is unchanged),
  `ViewControls` and `RightSidebar`.
- **2026-10-01, Task 5: `useAnimationPlayer` moved too.** Only `PreviewPanel` used it (`grep`
  found no other importer in `src/` or `tests/`). `docs/conventions.md` §7 still shows it as
  `// src/hooks/useAnimationPlayer.ts`; task 8 fixes that path with the other docs.
- **2026-10-01, Task 5: `view.toggleOnion` is `animationCommands()` in `animation/commands.ts`.**
  Same id, label, group, `isActive` and body; it takes no context, like `paletteCommands()`. The
  key stays `⌘⇧O` in `constants/shortcuts.ts` (unchanged). `useEditorCommands` loses it.
- **2026-10-01, Task 5: `attachCanvas` is wired in `hooks/useCanvasRenderer.ts`.** In the
  renderer-creation effect, right after the grid painter and its `useEditorStore` subscription,
  `EDITOR_MODULES.map((module) => module.attachCanvas?.(instance, doc))` collects the cleanups;
  the effect's cleanup runs them, then the grid unsubscribe, then `instance.dispose()`. All of
  this runs before `setRenderer(instance)`, so before the tool host attaches a tool's overlay.
  `animationModule.attachCanvas` is `attachOnion(renderer)` in `animation/attachCanvas.ts`: it
  adds the onion painter (moved unchanged: its own scratch `OffscreenCanvas`, `onion.enabled &&
  !p.isPlaying`) and subscribes to `useAnimationStore` to invalidate `onion` when `onion`
  changes. The grid subscription in `useCanvasRenderer` now covers only `gridEnabled` and
  `gridSize`. Registration order is unchanged: the grid painter, then the onion painter (the
  module loop runs after the grid), then any tool overlay.
  `docs/architecture.md` §4 ("the host registers the grid and onion painters … before any tool
  attaches") is still true; task 8 rewrites it to name the modules.
- **2026-10-01, Task 5: `EDITOR_MODULES` is `[palette, shell, layers, frames, animation]`.**
  Animation declares no hints, so the cheat sheet is unchanged. No import cycle: `useCanvasRenderer`
  (in `hooks/`) now imports `@/editor/modules`, and nothing `modules.ts` reaches imports
  `useCanvasRenderer`, `EditorCanvas` or `EditorPage` (`npm run lint` with `import/no-cycle` passes).
- **2026-10-01, Task 5: tests.**
  - The "setOnion merges a partial patch" case left `tests/unit/stores/viewSlice.test.ts` for the
    new `tests/unit/editor/animation/store.test.ts` (singleton after `resetEditorStores()`, same
    expected values). There was no playing test to move; the new file adds "tracks playback".
  - New `tests/unit/editor/animation/module.test.ts` (the contract's fake-renderer test): "attachCanvas
    adds one painter on the onion channel and removes it on cleanup", plus "repaints the onion
    channel when the onion config changes, until detached". The unit project goes from 323 to
    326 tests; the browser project stays at 274.
  - `resetEditorStores()` also resets `useAnimationStore`.
  - Reads that changed store and nothing else: `tests/browser/editor/frames.browser.test.tsx`,
    the two `isPlaying` assertions in "play is disabled for a single frame…"; and
    `tests/browser/components/OnionSkinControl.browser.test.tsx`, the three
    `onion.direction` assertions. That file also imports `OnionSkinControl` from
    `@/editor/animation/api` instead of `@/components/editor/OnionSkinControl`, and stays in
    `tests/browser/components/` (no browser test moved in tasks 1–4 either). Every expected value
    is unchanged.
  - Mutation probes (each restored from a copy): with the `attachCanvas` loop in
    `useCanvasRenderer` replaced by `EDITOR_MODULES.map(() => undefined)`, "onion skin ghosts
    the previous frame…" fails (`expected 0 to be greater than 0`); with `unsubscribe()` dropped
    from `attachOnion`'s cleanup, "repaints the onion channel … until detached" fails.
- **2026-10-01, Task 5: verification beyond the suites.**
  - Lint probe: `import "@/editor/animation/store"` added to the top of `frames/FramesBar.tsx`,
    `frames/commands.ts`, `shell/RightSidebar.tsx` and `shell/commands.ts` fails `npx oxlint`
    in each with `'@/editor/animation/store' import is restricted from being used by a pattern`.
    Each file was restored from a copy.
  - `grep -rn "onion\b\|isPlaying\|setPlaying\|setOnion" src | grep -v "src/editor/animation\|src/core"`
    lists only: `useCanvasRenderer`'s `useAnimationStore` selector, the renderer's `isPlaying`
    state field (initial value and `setState`), the `onion` channel (`data-canvas="onion"` in
    `EditorCanvas`, `targets.onion`), and `SETTING_KEYS.onion = "view.onion"` in
    `constants/settings.ts`, a settings key with no reader (pre-existing, untouched).
  - A throwaway browser probe ran on this tree and on `f01964f` in a scratch worktree (then
    removed). It reads only the DOM, the live document and the onion and preview canvases. It
    dumped all buttons (name, `aria-keyshortcuts`, disabled, `aria-pressed`) at open and at the
    end, the onion trigger's tooltip ("Onion skin settings⌘⇧O"), and, after each of 15 states, the
    onion pixel at (1,1) and (6,6), a hash of the whole onion canvas, a hash of the preview
    canvas, the trigger's `aria-pressed`, the play button's label and the popover (switches,
    opacity value). The states: two painted frames, ⌘⇧O on, off, on; popover open; opacity +10,
    −30, max; the popover's enable switch off and on; direction "after" on frame 2; frame 1;
    playing (onion cleared); paused; ⌘⇧O off. It also dumped the preview's fps text and the whole
    cheat sheet. The two JSON dumps (24,414 bytes each) are byte-identical. Ghost alpha reads
    89 at 35%, 115 at 45%, 140 at 55%, 0 while playing and 140 again when paused. The View group
    reads "Zoom in +=, Zoom out -_, Fit to window 0, Toggle pixel grid ⌘G, Toggle onion skin ⌘⇧O".

## Builder notes (from task 1, for tasks 2–8)

- **Plugging in a module.**
  - `src/editor/<m>/module.ts` exports `const xModule: EditorModule`: `id`, `commands(ctx)` (a plain function that reads stores lazily), `hints` and `attachCanvas`.
  - `<m>/api.ts` re-exports it `as module`.
  - Append one line to `EDITOR_MODULES` in `src/editor/modules.ts`, importing `{ module as x } from "@/editor/<m>/api"`.
- **Commands.** Move them from `useEditorCommands` into `<m>/commands.ts`. `EditorShell` merges module commands first, then what's left of `useEditorCommands()`. `modules.test.ts` catches duplicate ids across modules and tools, but not against `useEditorCommands`.
- **No cycles.** A module's `api.ts`, and anything it reaches, must never import `EditorPage`, `modules.ts` or `ShortcutHelpDialog`. `EditorPage` is imported by the router directly (`@/editor/shell/EditorPage`), not through `shell/api.ts`; this was accepted by the maintainer's session.
- **Imports.** Inside a module use `./`; across modules use `@/editor/<m>/api` only. In `.tsx` files, `db`, `services` and `export` are type-only imports.
- **Hint order.** The cheat sheet's hint rows follow `EDITOR_MODULES` order. Task 2 must keep the "Color" group's row order identical when `COLOR_HOTKEY_HINTS` moves to palette while `POINTER_PAINT_HINTS` stays on shell, until task 8.
- **Stores.** Task 2 introduces the first module store and `resetEditorStores()` in `tests/support`.
- **Module order (from task 2).** `EDITOR_MODULES` is `[palette, shell]` until task 8. Tasks 3–7 append their module at the end. Task 8 moves shell to the front when canvas takes `POINTER_PAINT_HINTS` and `CANVAS_VIEW_HINTS`. Canvas comes last, so the Color group still lists the 1–9 keys before "Paint with secondary color".
- **Module stores in tests (from task 2).** Add every new module store to `resetEditorStores()` in `tests/support/store.ts`. Test setup that sets module state goes through `@/editor/<m>/api`. A store's own unit test may import `@/editor/<m>/store` directly.
- **Unit tests load `api.ts` whole (from task 2).** Any `createToolHost` or support import of an `api.ts` also loads that module's panels. jsdom gaps (like `ResizeObserver`, now stubbed) surface as import failures in unrelated unit files. Stub them in `tests/support/setup.unit.ts`.
- **`dexie-react-hooks` in modules (from task 2).** Decision 10's `dexie*` bans `useLiveQuery` inside `src/editor/*/**`. `palette/usePalettes.ts` carries the one disable comment. If the maintainer narrows the rule, remove it.
- **Lint, decided by the maintainer's session (task 2):** in module `.ts` files (hooks), the database ban is `@/db/db` + `dexie` only, the same as `src/hooks/**`, so `dexie-react-hooks` (`useLiveQuery`) is allowed. Module `.tsx` files keep `dexie*`. The disable comment in `palette/usePalettes.ts` is removed.
- **Active targets (from task 3).** The active layer lives in `useLayersStore`; the active frame
  is still `useEditorStore.activeFrameId`. Task 4 must update the frame half of: both
  `activeTarget()` copies (`shell/historyAdapter.ts`, `hooks/toolHost/createToolHost.ts`),
  `usePointerPaint`'s `resolveTarget`, `EditorStatusBar`, and `layers/LayersPanel.tsx` (which
  reads `activeFrameId` for its thumbnails). `useActiveTargets` is now frame-only and returns
  `void`; task 4 replaces it with a frames guard next to `useActiveLayerGuard()` in `EditorShell`.
- **Cycles between module APIs (from task 3).** Once `LayersPanel` imports `@/editor/frames/api`,
  nothing that `frames/api.ts` reaches may import `@/editor/layers/api`, or `import/no-cycle`
  fails. Run `npm run lint` after adding any cross-module import.
- **UI probe (from task 3).** Vitest hides `console.log` from passing browser tests; run a
  throwaway probe with `--silent=false`. Hover a disabled `CommandButton`'s tooltip through its
  wrapper span (`button.parentElement`, `{ force: true }`), and read the text from
  `[data-slot="tooltip-content"]`.
- **Active targets (from task 4).** The active frame lives in `useFramesStore`
  (`@/editor/frames/api`). `useActiveTargets` is gone; `EditorShell` runs both guards.
  `useEditorStore` no longer holds either active target.
- **Cycles between module APIs (from task 4).** `layers → frames` is now a real edge
  (`LayersPanel` imports `@/editor/frames/api`). Task 5 moves `PreviewPanel`, which imports
  `@/editor/frames/api`, into `animation`; task 8 moves `useCanvasRenderer` and `usePointerPaint`,
  which import it too, into `canvas`. So nothing `frames/api.ts` reaches may import
  `@/editor/animation/api`, `@/editor/canvas/api` or `@/editor/layers/api`.
- **UI probe (from task 4).** A probe that reads only the DOM and `session().doc`, never a store,
  runs unchanged on both trees. Read a tooltip on an enabled `CommandButton` right after
  `openEditor()`: after several keyboard steps, hovering the "New frame" button's wrapper
  opened no tooltip in time. Frame-card actions are hidden until hover, so hover the card's
  `li` first, then the button, both with `{ force: true }`.
- **`attachCanvas` (from task 5).** `hooks/useCanvasRenderer.ts` calls every module's
  `attachCanvas(instance, doc)` in `EDITOR_MODULES` order inside the renderer-creation effect,
  after the grid painter and before `setRenderer(instance)`, and runs the returned cleanups
  before `instance.dispose()`. Task 6 moves the grid painter the same way: add
  `view/attachCanvas.ts` that adds the overlay painter and subscribes to the view store for
  `gridEnabled`/`gridSize`, then delete the inline painter, its `useEditorStore` subscription and
  the `drawGrid` import from `useCanvasRenderer`. Stacking on `overlay` stays grid → tool overlay
  because every module attaches before the tool host gets the renderer; "the selection fill
  draws above the grid lines" pins it. `tests/unit/editor/animation/module.test.ts` has the
  fake renderer to copy for task 6's test. Task 8 moves the loop into `canvas` with the hook.
- **Renderer readers (from task 5).** `useCanvasRenderer` reads `isPlaying` through
  `@/editor/animation/api` and imports `@/editor/modules`. When task 8 moves it into `canvas`,
  `modules.ts` will list `canvas` while `canvas` imports `modules.ts`; keep `canvas/api.ts` from
  reaching `useCanvasRenderer`, or `import/no-cycle` fails. `animation → frames` is now a real
  edge (`PreviewPanel`), and `useCanvasRenderer` (canvas, from task 8) imports
  `@/editor/animation/api`: nothing `animation/api.ts` reaches may import `@/editor/canvas/api`
  or `@/editor/layers/api`.
