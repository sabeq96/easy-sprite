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

1. **shell + mechanism.**
   - Add `module.ts` and `modules.ts`.
   - Move the shell files, and move undo, redo, save, help and back into `shell/commands.ts`.
   - `EditorPage` merges `EDITOR_MODULES` commands with what's left of `useEditorCommands`.
   - The cheat sheet reads hints from `EDITOR_MODULES` and `TOOL_LIST`, and `FEATURE_HINTS` is deleted.
   - The `history` adapter moves here.
   - Add the lint override (Decision 10).
2. **palette.**
   - `colorSlice` → `palette/store.ts`.
   - Move the components and hooks, and the color commands.
   - `COLOR_HOTKEY_HINTS` → `module.hints`.
   - The `colors` adapter moves here.
3. **layers.** `activeLayerId` → `layers/store.ts`. Move the components and the layer commands, and the layer half of `useActiveTargets`.
4. **frames.** `activeFrameId` → `frames/store.ts`. Move the components and the frame commands, and the frame half of `useActiveTargets` (then delete `useActiveTargets`).
5. **animation.**
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
