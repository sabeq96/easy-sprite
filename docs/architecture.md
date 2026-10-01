# Architecture

## 1. The one decision everything else follows from

A 64×64 sprite with 8 frames and 3 layers is 24 cels × 16 KB = ~400 KB of pixels. Painting a
stroke touches thousands of pixels per second. **React must never re-render because a pixel
changed.**

So the app has two state systems that are deliberately kept apart:

```
┌─────────────────────────────── React tree ────────────────────────────────┐
│  Module stores (zustand,     Structure state (SpriteDocument + revisions)  │
│  one per editor module)      layer list, frame list, names, opacity, size  │
│  palette: colors · view:     → React re-renders on these (they're rare)    │
│  zoom, grid · animation:                                                   │
│  onion cfg · toolbox: tool                                                 │
└───────────────────────────────────────────────────────────────────────────┘
                                     │ reads, never re-renders on
                                     ▼
┌────────────────────── Imperative core (no React) ─────────────────────────┐
│  Cel pixel buffers (Uint8ClampedArray) → ImageData → OffscreenCanvas       │
│  Tools mutate buffers → emit dirty rects → Renderer redraws on rAF         │
│  History records patches → Autosave flushes dirty cels to Dexie            │
└───────────────────────────────────────────────────────────────────────────┘
                                     │ debounced writes
                                     ▼
                            IndexedDB (Dexie 4)
```

Everything under `src/core/` is framework-free and unit-testable without a DOM renderer.
Everything under `src/editor/` (the pixel editor's host modules, §11) and `src/components/` is
React-side and holds no pixel data.

One consequence is easy to get wrong: because the document mutates in place, React components
must never read its fields during render. They go through `useDocumentSnapshot`, and the
document replaces its `layers`/`frames` arrays rather than splicing them. See
[conventions.md §6c](conventions.md).

## 2. Folder map

One line per folder: what belongs there. Individual files are not listed — they change too often
for a map to stay true. The dependency rules between these folders are in §9.

```
src/
  core/         the imperative core, zero React: SpriteDocument, cels, pixels, history, renderer,
                its grid and onion painters (painters/), viewport, overlays, command factories
                (commands/). Knows nothing about tools or the host
  framework/    the host↔tool contract: types and tiny pure helpers that both tools and the host
                depend on (host.ts: ToolHost, Gesture, Surface; tool.ts: Tool, defineTool;
                command.ts: ContributedCommand; settings.ts: setting kinds, resolveSettings)
  tools/        one folder per tool (<tool>/tool.ts, plus anything else it needs: icon, overlay,
                JSX), shared/ for code several tools use, and index.ts, the one registry every
                tool list derives from. Adding a tool is a folder plus one line in TOOL_LIST
  editor/       the pixel editor's host, one folder per domain module (§11): shell/, palette/,
                layers/, frames/, animation/, view/, toolbox/, canvas/. Each owns its UI, its
                store (store.ts), its commands, hints and painters, and shows other modules only
                its api.ts. module.ts defines EditorModule; modules.ts lists them (EDITOR_MODULES)
  app/          routes, the app shell, providers, DocumentProvider (the open document's context),
                RouteErrorBoundary (a crashed page shows CrashPage instead of a blank screen)
  components/   React for the other surfaces: manager/ (the library), builder/ (the spritesheet
                composer), settings/, plus common/ (components several surfaces share, the editor
                included) and ui/ (generated shadcn primitives — add variants, never fork)
  hooks/        shared hooks: document revisions and snapshots, DnD, shortcuts, command dispatch,
                thumbnails, history state, and the library's and builder's hooks, including the
                domain action hooks (useSpriteActions, useSpritesheetActions, useBackupActions)
                that are the only way components reach the database, services and export
  commands/     the command contract shared by both editors: types, CommandsProvider (a registry
                plus a subscribe for live button state), the keymap helpers that read a
                registry's keys, the gesture hint types; and the builder's commands. The pixel
                editor's commands, with their keys, live in its modules
  stores/       zustand stores outside the pixel editor: the builder's view store and the theme
  db/           Dexie schema and instance, repositories/ (the only code that queries tables),
                typed errors, seed data, whole-database backup
  services/     where db/ and core/ meet: open/save a document, autosave, thumbnails, PNG import
  export/       renders documents to PNG and triggers downloads
  lib/          pure functions (color, rects, sheet rows and layout, library search/sort, …)
  constants/    tuning values and static config, grouped by domain; no logic
  types/        shared domain types that are not persisted records
```

## 3. Pixel representation

A **cel** is the pixels of one layer on one frame. It is the atom of storage and editing.

```ts
pixels: Uint8ClampedArray   // length = width * height * 4, straight (non-premultiplied) RGBA
```

Three properties hang off the same memory:

```ts
const pixels = new Uint8ClampedArray(w * h * 4);
const imageData = new ImageData(pixels, w, h);   // shares the buffer — no copy
const canvas = new OffscreenCanvas(w, h);        // raster cache for compositing
```

`ImageData` wrapping the same `Uint8ClampedArray` means a tool writes into `pixels` and the only
sync step is `ctx.putImageData(imageData, 0, 0)` on the cel's own canvas — which we do lazily,
once per frame, only for cels marked dirty.

### Why raw RGBA and not PNG blobs in IndexedDB

PNG in IndexedDB would be ~10× smaller, but decoding goes through `createImageBitmap` /
canvas, which is async **and** round-trips translucent pixels through premultiplied alpha —
`rgba(255,0,0,0.5)` can come back as `(254,0,0,0.5)`. A pixel editor that silently mutates the
user's colors on reload is broken. Raw buffers are lossless, synchronous, and structured-clone
native. PNG encoding is used only where loss doesn't matter: thumbnails and export.

Budget check: 128×128 × 4 layers × 24 frames = 48 MB. That is the practical ceiling and it is
well inside IndexedDB quota; the editor warns above it.

## 4. Rendering pipeline

Four stacked `<canvas>` elements, identical CSS box, `position:absolute`, painted in one rAF:

| z | Canvas | Redrawn when | Contents |
| --- | --- | --- | --- |
| 0 | `checker` | viewport changes | transparency checkerboard (CSS gradient div, not canvas) |
| 1 | `onion` | frame/onion config changes | the onion painter: the previous or next frame's composite, faded |
| 2 | `main` | any dirty cel, frame or layer change | composite of visible layers of current frame |
| 3 | `overlay` | the active tool asks (pointer move, its own state), a tool setting changes, grid toggle | registered painters in order: grid, then the active tool's overlay (the selection, or the pencil's and eraser's brush preview) |

The renderer only knows channels. `main` is built in; `onion` and `overlay` draw whatever
painters are registered on them (`addPainter`), in registration order. Host modules register
their own painters through `attachCanvas` (§11): `view` adds the grid painter on `overlay` and
`animation` the onion painter on `onion` (both drawn by `src/core/painters/`), and each subscribes
to its own store to repaint its channel. The `canvas` module calls every module's `attachCanvas`,
in `EDITOR_MODULES` order, when it creates the renderer, before any tool attaches, so a tool's
overlay always draws above the grid.

Per-frame work:

```
for each dirty cel:  putImageData(cel.imageData) → cel.canvas
composite:           for layer of visible layers (bottom→top):
                       ctx.globalAlpha = layer.opacity
                       ctx.drawImage(cel.canvas, 0, 0)     // on a w×h OffscreenCanvas
present:             mainCtx.imageSmoothingEnabled = false
                     mainCtx.drawImage(composite, ox, oy, w*scale, h*scale)
```

The composite canvas is sprite-resolution (e.g. 64×64); only the final `drawImage` scales. That
keeps cost independent of zoom level and makes nearest-neighbour upscaling the browser's job.

Dirty rectangles are tracked but the composite is recomputed wholesale when any cel is dirty —
at sprite resolutions this is microseconds, and partial compositing with per-layer alpha is a
correctness trap. Dirty rects **are** used to bound the `putImageData` region for large canvases.

All canvases are sized `cssSize * devicePixelRatio` with `ctx.setTransform(dpr,0,0,dpr,0,0)`,
so a 1-device-pixel grid line stays crisp on retina.

## 5. Coordinate systems

```
client (event.clientX)  →  view (minus canvas bounding rect)  →  sprite (integer pixel)
sprite = floor((view - origin) / scale)
```

`Viewport { scale, originX, originY }` lives in the `view` module's store (UI state — it is allowed to
re-render React; it changes at most once per wheel tick). Zoom is snapped to a ladder
(`0.5,1,2,3,4,6,8,12,16,24,32`) and zooms around the cursor:

```ts
origin = cursor - (cursor - origin) * (newScale / oldScale)
```

Pointer events use `setPointerCapture` so a stroke that leaves the canvas keeps painting, and
`getCoalescedEvents()` so fast strokes don't skip pixels between samples (on top of Bresenham
interpolation, which handles the rest).

## 6. Undo/redo

A command stack of inverse-able operations, capped at 100 entries or 64 MB, whichever first.

- **Pixel edits** are recorded by a `StrokeRecorder`: on the first write to a cel during a
  stroke it snapshots that cel's buffer; on pointer-up it computes the union dirty rect, crops
  `before`/`after` to it, and pushes one `PixelEditCommand`. One stroke = one undo step, which is
  what users expect, and history size is proportional to what actually changed, not to the canvas.
- **Structural edits** (add/delete/reorder layer or frame, resize canvas) are explicit
  command objects with `undo()`/`redo()` closures over the removed data.

History is per-open-document and lives in memory only; it is not persisted. That is a deliberate
simplification — persisting undo across reloads would multiply DB writes for little value.

## 7. Persistence

Dexie 4 with typed `EntityTable`s. Writes are never synchronous with drawing:

- Tools mark cels `storeDirty`.
- An `AutosaveController` flushes on a debounce (`AUTOSAVE_DEBOUNCE_MS`, 2 s), on `visibilitychange`, on route change,
  and on `beforeunload` (best-effort), in one `db.transaction('rw', ...)` per flush.
- Thumbnails regenerate at most every `THUMBNAIL_THROTTLE_MS` (5 s) while editing.
- The sprite gallery reads through `useLiveQuery`, so saves show up there with no manual wiring.

IDs are `crypto.randomUUID()` strings, not auto-increment integers, so JSON backups can be
re-imported without remapping foreign keys.

## 8. Testing strategy

Two Vitest projects, chosen by one question — does the code under test import React, touch the
DOM, or read a canvas?

- **No → `tests/unit/**`** (jsdom, `fake-indexeddb`). The core is pure functions over typed arrays,
  which is the easy 80%: pixels, history, document structure, repositories, backup round-trips,
  sheet rows and layout, library search/sort, stores.
- **Yes → `tests/browser/**`** (real Chromium through Playwright). jsdom has no real canvas, so
  anything that renders, drags or paints runs here: interactions (strokes, selection moves),
  flows through the real routes (library, editor, composer), export pixels, and components.

`npm test` runs the unit project; `npm run test:browser` the browser one. See
[conventions.md §11](conventions.md) for where tests go and what they assert on.

## 9. Module boundaries

The dependency graph has one legal direction. An arrow means "may import from"; the right column
says whether `.oxlintrc.json` enforces it, so the table never claims more than the build checks.

```
constants/  ──►  constants; types from lib                                  lint
lib/        ──►  lib, constants, types                                      lint
types/      ──►  types from db/schema                                       lint (types only)
core/       ──►  lib, constants, types                                      lint (no React/DB/UI,
                                                                            no framework/tools)
framework/  ──►  core, lib, constants, types; types from commands/hints
                 and lucide-react                                           lint (no React runtime/UI)
tools/<t>/  ──►  framework, tools/shared, own folder (./), core (not document,
                 history or renderer), lib, constants, lucide-react;
                 types from commands                                        lint (no host state/data,
                                                                            no other tool, no
                                                                            concrete core)
db/         ──►  lib, constants, types                                      lint (no core/UI)
export/     ──►  core, lib, constants, types; types from db/schema          lint (no React/UI)
services/   ──►  db, core, export, lib, constants, types                    lint (no React/UI)
stores/     ──►  core, lib, constants, types; types from framework, tools   lint (no React/UI)
commands/   ──►  core, framework, tools, stores, hooks, app (document context),
                 lib, constants; types from editor/modules                  lint (no db/UI)
hooks/      ──►  services, export, db/repositories, stores, core, framework, tools,
                 commands, app (document context), lib, constants           lint (no raw db, no components)
components/ ──►  hooks, stores, commands, core, framework, tools,
                 app (document context), lib, constants, types;
                 types from db/schema and services                          lint (no db/services/export)
editor/<m>/ ──►  own folder (./), other modules' api.ts, editor/module(s),
                 core, framework, tools, commands, components, hooks,
                 app (document context), lib, constants, types;
                 .ts files also db/repositories, services, export           lint (other modules only via
                                                                            api.ts, no ../, no raw db;
                                                                            .tsx: no db/services/export)
app/        ──►  everything
```

Wherever `tools` appears on the host side (stores, commands, hooks, components, editor, app), it
means the registry, `@/tools`: lint rejects any file inside a tool's folder. Nothing outside
`src/editor/` imports a module at runtime except the router, which imports
`@/editor/shell/EditorPage`.

Reading it out loud: **pure things never import impure things, nothing below React imports React,
components reach data only through hooks, and an editor module reaches another only through its
`api.ts`.** `core/` staying React-free is what makes the core testable with no DOM; hooks being
the only door to `db/`, `services/` and `export/` is what keeps loading, error reporting and
toasts in one place per domain (§10).

Three edges are known compromises: hooks, commands and editor modules read the open document
through `app/DocumentProvider`; `framework/` borrows the hint *type* from `commands/`; and
`commands/types.ts` derives `CommandId` from `editor/modules` by type (`ModuleCommandId`). All
three are type- or context-only; moving the document context below `app/` would remove the first.

Every group is written with `/**` (`@/components/**`): in oxlint a `*` does not cross `/`, so a
single `*` would block only the first level under a folder.

### Tool host

A tool receives two things, both interfaces in `src/framework/host.ts`: a long-lived
**`ToolHost`** (what it may use) and, per pointer event, a **`Gesture`** (what is happening:
point, previous point, modifiers, colour slot, and a `Surface` pinned to the stroke's layer and
frame). The host groups its capabilities by domain, all as methods so every read is live:

| Capability | Members | Provided by | Backed by |
| --- | --- | --- | --- |
| `colors` | `get(slot)`, `set(slot, c)` | `palette` (`colorsAdapter.ts`) | the palette store's primary and secondary colours |
| `canvas` | `setOverlay(paint)`, `requestRender()` | `canvas` (`toolHost/createToolHost.ts`) | a painter on the renderer's `overlay` channel (above the grid), once `EditorCanvas` attaches it |
| `document` | `width`, `height`, `sampleComposite`, `crop`, `onResize` | `canvas` (`toolHost/createToolHost.ts`) | the open `SpriteDocument`, and the active layer and frame from the `layers` and `frames` stores |
| `history` | `edit(label, change)`, `onUndoRedo` | `shell` (`historyAdapter.ts`) | a `StrokeRecorder` over the active layer and frame, pushed as one undo entry; the `Surface` it hands the tool comes from `canvas` |
| `tool` | `activate()`, `settings()`, `set(key, value)` | `toolbox` (`toolAdapter.ts`) | `setTool` (synchronous), and the toolbox store's `settings[toolId]` resolved against the tool's declared defaults |

Each adapter lives in the module that owns its state and is exported through that module's
`api.ts`; `canvas/toolHost/createToolHost.ts` assembles them into one host per open document.
`EditorPage` creates it and provides it with `ToolHostProvider`, so the modules' commands and
the canvas's gestures share it. The `Surface` of a stroke is built by `canvas/toolHost/surface.ts`
and pinned at pointerdown. A tool never sees the document, the undo stack, a store, or layer and
frame ids.

A tool's options are **settings** it declares as data (`Tool.settings`, built with `choice`,
`toggle` and `switchSetting` from `src/framework/settings.ts`). The host stores only changed
values, keyed `settings[toolId][key]` in the toolbox store, so the store names no setting;
`ToolOptionsBar` (in `editor/toolbox/`) renders them by kind through `useToolSettings`; and a setting's `command` becomes a Tools command with
its key. ToolHost is generic over the declaration (`ToolHost<S>`), so `host.tool.settings()` is
typed. The brush preview is the pencil's and eraser's own overlay (`src/tools/shared/brush.ts`).

## 10. Data access

One path from a click to the database and back:

```
component ──calls──► domain action hook ──► repository / service / export
    ▲                    │ success/failure → toast (runWithToast / useAsyncAction)
    └── useLiveQuery ◄───┴─ Dexie notifies every live query that read the rows it wrote
```

- **Reads** are live: a hook wraps `useLiveQuery` around a repository call (`useLibrary`,
  `useSpriteSizes`, and `usePalettes` in `editor/palette/`), so a write anywhere re-renders every
  surface showing it.
  `undefined` from `useLiveQuery` means "not loaded yet" — keep it distinct from "empty".
- **Writes** go through a domain action hook (`useSpriteActions`, `useSpritesheetActions`,
  `useBackupActions`, and `usePaletteActions` in `editor/palette/`). The hook owns the user-facing message; components
  never build an error string or call `toast.error` for a failed write.
- **Optimistic order** (drag reorders) goes through `useOptimisticOrder`, which shows the proposed
  order until the live query catches up.
- **Errors**: repositories throw typed errors (`NotFoundError`, `QuotaError`); action hooks turn
  them into toasts; a render crash is caught by `RouteErrorBoundary`. User data that can be
  malformed (backups, palette files) is validated into a `Result` instead of throwing.

See [conventions.md](conventions.md) for the full code standard: file/function size limits,
naming, where a piece of logic belongs (hook vs util vs store vs core), barrel-file policy,
and the lint config that enforces it.

## 11. Modules

The pixel editor is built from three kinds of code, and one rule says which is which:

| Kind | Where | Role |
| --- | --- | --- |
| **Core** | `src/core/` | The framework-free document, pixels, history and renderer. Knows nothing about tools or the host |
| **Host modules** | `src/editor/<domain>/` | Each **provides** capabilities, and owns its UI, its state, its commands and hints, and its canvas painters |
| **Tools** | `src/tools/<tool>/` | Each **consumes** the host only through the interfaces in `src/framework/` (`ToolHost`, `Gesture`, `Surface`) |

Everything else (`db/`, `services/`, `export/`, `lib/`, `constants/`, the shared `hooks/`,
`components/ui` and `components/common`) is shared infrastructure. The library, builder and
settings pages keep their layer folders (`components/<surface>/`, `hooks/`, `stores/`).

The eight host modules:

| Module | Owns | Store | Provides |
| --- | --- | --- | --- |
| `shell` | the page and its layout (`EditorPage`), top bar, menu, status bar, cheat sheet, resize dialog; undo, redo, save, help and back | none | `ToolHost.history` |
| `palette` | the palette panel and menu, active colours, colour hotkeys; swap and reset | primary, secondary, active palette | `ToolHost.colors`, the 1–9 hints |
| `layers` | the layers panel; layer commands | active layer | the active layer |
| `frames` | the frames bar; frame commands | active frame | the active frame |
| `animation` | the preview panel and player, onion skin control; the onion toggle | onion config, playing | the onion painter |
| `view` | zoom and grid controls, the checkerboard; zoom, fit and grid commands | viewport, container size, grid, chessboard | the grid painter, the viewport |
| `toolbox` | the tool sidebar and options bar; tool commands, and the commands tools and settings contribute | active tool, held tool, tool settings | `ToolHost.tool` |
| `canvas` | `EditorCanvas`, the renderer, pointer input, the tool lifecycle, pan and zoom input | cursor position | the `ToolHost` assembly, `ToolHost.canvas` and `.document`, the `Surface`, the right-drag and pan hints |

A module folder holds:

- **`api.ts`**, its public face. Other modules import only `@/editor/<m>/api`, and it exports
  only what they use: the components the shell places, store hooks, ToolHost adapters, and the
  module itself (`export { xModule as module }`). Lint rejects a deep import into another module
  and any `../`. It is a barrel by choice, not one that re-exports the folder (conventions §5).
- **`module.ts`**, its `EditorModule` (`src/editor/module.ts`), made with `defineModule` so its
  command ids stay literal:
  - `id`;
  - `commands`: static `ModuleCommand` definitions (`id`, `label`, `group`, `keys`,
    `isEnabled`/`isActive(ctx)`, `run(ctx)`, and `hold(ctx)` for the tool keys), the same shape
    as `Tool.commands`. The shell binds them (`bindCommands`) on every render to a
    `ModuleContext` (`doc`, `history`, `dispatch`, `navigate`, `showHelp`, `save`, `forTool`);
    handlers read stores when they run;
  - `hints`: inputs that are not commands (1–9, right-drag, pan), each joining the cheat-sheet
    group it names;
  - `attachCanvas(renderer, doc)`: registers painters and repaint listeners when the renderer is
    created, and returns their cleanup;
  - `subscribe`: the module store's `subscribe`. Declare it when the module's commands read its
    store, so bound buttons follow the store. `canvas` declares none: its cursor store changes
    on every pointer move and no command reads it.
- **`store.ts`**, its own zustand store. Nothing composes the stores.
- **`commands.ts`**, its command definitions with their keys (`defineCommands`), and its
  components, hooks and adapters.

`src/editor/modules.ts` lists every module once, in a static array:

```ts
export const EDITOR_MODULES = [shell, palette, layers, frames, view, animation, toolbox, canvas];
```

`ModuleCommandId`, every id the modules declare, is derived from this list, and `CommandId` (in
`src/commands/types.ts`) includes it, so there is no hand-kept list of ids.

The order matters in two places. Rows in one cheat-sheet group follow it: command rows in
registry order (`view` before `animation` keeps the View group as zoom, fit, grid, onion), then
hint rows (`canvas` after `palette` keeps "Paint with secondary color" below the 1–9 keys). And
`attachCanvas` runs in it. Groups themselves follow `COMMAND_GROUPS` (`src/constants/commands.ts`).
The shell binds every module's commands into one registry (`bindEditorCommands`) for
`useShortcuts`, the cheat sheet and `CommandsProvider`; that registry is the keymap. It provides
`subscribeToModules` (every module's `subscribe` as one) next to the registry, so a
`CommandButton` re-reads `isActive` and `isEnabled` whenever any module store changes. The shell
also hands `EDITOR_MODULES` to `<EditorCanvas modules>`, which calls each `attachCanvas`. `canvas`
cannot import the list itself, because the list holds `canvas` and `import/no-cycle` would reject
the loop.

Adding to the editor:

- **A command, key or panel in an existing domain** touches only that module: a command and its
  keys are one definition in its `commands.ts`, and a panel is its components. The id joins
  `CommandId` by derivation. Keys the spritesheet composer shares (undo, redo, save, zoom, fit,
  grid, help, back) come from `SHARED_KEYS` (`src/constants/shortcuts.ts`).
- **A new domain** is a folder with `api.ts`, `module.ts` and whatever it owns, plus one line in
  `EDITOR_MODULES`. The shell places its panel in plain JSX: there is no slot system.
- **A new tool** never touches a module: it is a folder in `src/tools/` plus one line in
  `TOOL_LIST`, and it reaches the host only through `ToolHost`.

Two dependency rules keep the module graph acyclic, and `import/no-cycle` checks both. Nothing
that a module's `api.ts` reaches may import `EditorPage` or `modules.ts` at runtime (the type
import of `ModuleCommandId` in `commands/types.ts` is fine: the rule ignores type-only imports).
And when the provider of a ToolHost adapter needs something from `canvas`, `canvas` passes it in:
the history adapter takes the surface factory as an argument, because `canvas/toolHost/` imports
`shell/api.ts`.
