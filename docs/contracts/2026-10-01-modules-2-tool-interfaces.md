# Modules 2/5: tools consume the host through interfaces, and contribute their own commands

Status: approved (2026-10-01)
Date: 2026-10-01
Depends on: [1 tool folders](2026-10-01-modules-1-tool-folders.md) merged
Series: [0 core](2026-10-01-modules-0-core-rename.md) · [1 tool folders](2026-10-01-modules-1-tool-folders.md) · [2 tool interfaces](2026-10-01-modules-2-tool-interfaces.md) · [3 settings](2026-10-01-modules-3-settings.md) · [4 painters](2026-10-01-modules-4-renderer-painters.md) · [5 host modules](2026-10-01-modules-5-host-modules.md)

## Context

Read "Why this series exists" in [stage 0](2026-10-01-modules-0-core-rename.md) first.

Today a tool receives the concrete core:

- `ctx.doc` (a `SpriteDocument`: it calls `ensureCel`, `getCel` and `markPixelsChanged`);
- `ctx.stroke` (a `StrokeRecorder`: it calls `touch` and `extend`);
- `session.history` (it subscribes to `History.events`);
- `layerId` and `frameId`.

It also gets three separate context shapes: `ToolContext` per gesture, `ToolSession` per
activation, and, for the select tool, the commands built for it in `useEditorCommands`.

The select tool's six commands live in the shared `src/commands/useEditorCommands.ts`
(~lines 86-150). That forces three things:

- an exported `selection` object;
- the ids into the central `APP_COMMAND_IDS`;
- the keys into `APP_SHORTCUTS`.

Its pixel helpers live in the core, but nothing else uses them.

## Goal

A tool receives exactly **two** things, both defined as interfaces in `src/framework/host.ts`:

- **`ToolHost`** is long-lived: what the tool may use. It groups capabilities by domain and
  exposes them as methods, so every read is live:
  - `host.colors.get(slot)` and `host.colors.set(slot, c)`
  - `host.canvas.setOverlay(paint)` and `host.canvas.requestRender()`
  - `host.document.width`, `.height`, `.sampleComposite(x, y)`, `.crop(rect)` and `.onResize(fn)`
  - `host.history.edit(label, change)` and `host.history.onUndoRedo(fn)`
  - `host.tool.activate()`
- **`Gesture`** describes what's happening now: `point`, `previous`, `modifiers`, the colour
  `slot` chosen by the mouse button, and a **`surface`**. The surface is the active layer and
  frame as a drawing surface:
  - `read(x, y)`
  - `buffer()`: writable, snapshots the cel for undo on first use
  - `commit(dirty)`: records the change and repaints
  - `revert()`: puts back every pixel this gesture changed, and records nothing

A tool never sees `SpriteDocument`, `StrokeRecorder`, `History`, the store, or layer and frame ids.

Tools also declare full command definitions (`Tool.commands`). The select tool owns its six
commands, keys, clipboard and region helpers inside `src/tools/select/`, and `selection` is
no longer exported. Command ids and keys are unchanged.

## Non-goals

- No behaviour change: every key, label, enabled state, undo step and the cheat sheet stay as they are.
- No settings change. `ToolOptions` stays as `host.tool.options()` (a temporary pass-through
  that stage 3 replaces). `tool.cycleBrushSize` and `tool.toggleMirror` stay as app commands.
- The brush preview stays in `usePointerPaint` (stage 3).
- Host modules (stage 5). The adapters live in `src/hooks/toolHost/` for now, and stage 5 moves them to `src/editor/canvas/`.

## Decisions

| # | Decision | Why | Rejected alternative |
|---|----------|-----|----------------------|
| 1 | **Settled by the maintainer.** Tools reach the host only through interfaces, grouped by domain and called as methods (`host.colors.get("primary")`) | Live reads, small fakes, and no dependency on host internals | Property getters (a value cached at activation silently goes stale). One flat list of functions (a shallow, ~20-member host) |
| 2 | **Settled by the maintainer.** Pixel access goes through a **`Surface`** pinned to the gesture's layer and frame. `buffer()` creates the cel and snapshots it for undo on first call. `commit(dirty)` records and repaints. `revert()` restores the snapshot | Tools can't forget `touch`, or write to a locked layer. Undo stays one stroke = one entry. `revert()` replaces `abandonDrag`'s hand-stamping | Keeping `doc` and `stroke` in the context |
| 3 | **One `ToolHost` per open document**, passed to every tool callback: `onActivate`, `onHover`, the pointer handlers and contributed commands. `ToolContext` and `ToolSession` are deleted | One host shape, plus one gesture shape per stroke | Separate session and command hosts |
| 4 | The colour is chosen by `gesture.slot` (`"primary"` for the left button, `"secondary"` for the right). Pencil reads `host.colors.get(g.slot)`, and the picker writes `host.colors.set(g.slot, c)` | The right-click policy stays in the host (the pointer pipeline), and tools say what they mean | Tools reading `modifiers.button` |
| 5 | Edits made outside a gesture (cut, paste, delete) use `host.history.edit(label, change)`. It runs `change(surface)` against a recording surface for the active layer and frame, and pushes one undo entry. It returns `false` when there is no editable target (locked or hidden layer, or nothing chosen yet) | Every pixel change, gesture or command, goes through the same recorded surface. `cutSelectionCommand`, `clearSelectionCommand` and `pasteCommand` (hand-built undo commands) are replaced | Keeping per-command undo factories |
| 6 | `host.document.crop(rect)` returns the active cel's pixels in `rect` (transparent where empty), or null with no target. Copy uses it | A read-only path that never creates a cel | Copy through `edit` (it would create an undo entry) |
| 7 | `host.document.onResize(fn)` and `host.history.onUndoRedo(fn)` replace the select tool's direct `doc.events` and `history.events` subscriptions | The tool's two invalidation rules stay, expressed as capabilities | Exposing the emitters |
| 8 | `host.tool.activate()` switches to the calling tool synchronously (`setTool` underneath, and `useToolLifecycle` subscribes synchronously) | Paste and Select all activate the select tool and then set the selection in the same tick | An async callback |
| 9 | `Tool.commands` holds full **definitions** `{ id, label, group, keys?, isEnabled?(host), isActive?(host), run(host) }`. The host merges them into the registry and `SHORTCUTS`. The ids keep their names (`edit.copy`, …) and leave `APP_COMMAND_IDS` and `APP_SHORTCUTS`. `ContributedCommandId` is derived from `TOOL_LIST` with `const` generics, and `CommandId = AppCommandId \| ToolCommandId \| ContributedCommandId` | The tool owns its commands. Ids stay type-checked without a central list, and nothing outside changes | A list of ids on the tool. Widening `CommandId` to `string` |
| 10 | The cheat sheet's tool sections and `TOOL_OWNED_COMMANDS` derive from `tool.commands` definitions plus `tool.hints` | Same source, so they can't drift | — |
| 11 | `core/selection.ts`, `core/commands/selection.ts` and `core/clipboard.ts` move into `src/tools/select/` (`region.ts`, `clipboard.ts`). Their helpers are rewritten over `{ pixels, width, height }` buffers instead of `(doc, layerId, frameId)`. Their tests follow to `tests/unit/tools/select/` | A fully encapsulated tool. Nothing else uses them | Leaving them in core |
| 12 | The host is built once per open document in the shell (`ToolHostProvider`, `useToolHost()`). The `canvas` adapter forwards to the renderer once `EditorCanvas` attaches it, and is a no-op before that | Commands (shell) and gestures (canvas) share one host instance | Building the host inside `EditorCanvas` (commands live above it) |
| 13 | **Lint, host side.** `src/commands/**`, `src/hooks/**`, `src/components/**`, `src/stores/**` and `src/app/**` may import `@/tools/index` but no other `@/tools/*`. Tool folders gain a ban on `@/core/document`, `@/core/history` and `@/core/renderer` | The host sees tools only through the registry, and tools can't reach the concrete core | Review-only rules |

## Data flow

```text
pointer pipeline (usePointerPaint)
  pointerdown ─► resolve target (layer/frame, locked/hidden → stop) ─► new StrokeRecorder
             ─► gesture = { point, previous, modifiers, slot: button 2 ? "secondary" : "primary",
                            surface: createSurface(doc, layerId, frameId, recorder) }
             ─► tool.onPointerDown(host, gesture)
  pointerup  ─► recorder.commit() → history.push   (unchanged: one stroke, one undo entry)

ToolHost (one per document, from ToolHostProvider)
  colors   ─► editor store primary/secondary
  canvas   ─► renderer.setToolOverlay / invalidate("overlay")   (bound when EditorCanvas mounts)
  document ─► doc.width/height, compositeFrame sample, crop of the active cel, doc "meta" events (size change)
  history  ─► edit: StrokeRecorder over the active target → history.push; onUndoRedo: history "change" ≠ push
  tool     ─► setTool(tool.id); options() (pass-through until stage 3)

contributed commands: TOOL_LIST.flatMap(t => t.commands) ─► registry (bound to host) + SHORTCUTS
```

## Interfaces

```ts
// src/framework/host.ts
import type { RGBA } from "@/lib/color";
import type { Rect } from "@/lib/rect";
import type { Point, Viewport } from "@/core/viewport";
import type { PixelBuffer } from "@/types/pixels";

export type ColorSlot = "primary" | "secondary";
export type OverlayPaint = (ctx: CanvasRenderingContext2D, viewport: Viewport) => void;

export interface Colors {
  get(slot: ColorSlot): RGBA;
  set(slot: ColorSlot, color: RGBA): void;
}
/** The active layer on the active frame, as something to draw on. */
export interface Surface {
  readonly width: number;
  readonly height: number;
  /** Transparent when out of bounds or nothing is drawn there. */
  read(x: number, y: number): RGBA;
  /** Writable pixels. The first call creates the cel and snapshots it for undo. */
  buffer(): PixelBuffer;
  /** Records `dirty` as changed and repaints. Null or empty is a no-op. */
  commit(dirty: Rect | null): void;
  /** Puts back every pixel changed through this surface, and records nothing. */
  revert(): void;
}
export interface DocumentView {
  readonly width: number;
  readonly height: number;
  /** The merged image of the active frame at (x, y); null outside the sprite. */
  sampleComposite(x: number, y: number): RGBA | null;
  /** The active cel's pixels in `rect`; null when there is no active target. */
  crop(rect: Rect): PixelBuffer | null;
  /** Called after the sprite's width or height changes. */
  onResize(listener: () => void): () => void;
}
export interface Canvas {
  /** The calling tool's overlay, drawn above the grid. Removed when the tool deactivates. */
  setOverlay(paint: OverlayPaint | null): void;
  requestRender(): void;
}
export interface Edits {
  /** One undoable edit of the active layer and frame. False when nothing is editable. */
  edit(label: string, change: (surface: Surface) => void): boolean;
  /** Undo or redo moved pixels (not a new edit). */
  onUndoRedo(listener: () => void): () => void;
}
export interface ToolControl {
  /** Makes the calling tool active, synchronously. */
  activate(): void;
  /** Stage 2 only: today's ToolOptions, replaced by settings in stage 3. */
  options(): ToolOptions;
}
export interface ToolHost {
  readonly colors: Colors;
  readonly canvas: Canvas;
  readonly document: DocumentView;
  readonly history: Edits;
  readonly tool: ToolControl;
}
export interface Gesture {
  readonly point: Point;
  /** The previous sample of this gesture; equals `point` on pointerdown. */
  readonly previous: Point;
  readonly modifiers: PointerModifiers;
  readonly slot: ColorSlot;
  readonly surface: Surface;
}

// src/framework/command.ts
export interface ContributedCommand<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly group: CommandGroup;
  readonly keys?: readonly KeyBinding[];
  isEnabled?(host: ToolHost): boolean;
  isActive?(host: ToolHost): boolean;
  run(host: ToolHost): void;
}

// src/framework/tool.ts: handler signatures
onPointerDown(host: ToolHost, gesture: Gesture): void;
onPointerMove?(host: ToolHost, gesture: Gesture): void;
onPointerUp?(host: ToolHost, gesture: Gesture): void;
onActivate?(host: ToolHost): () => void;
onHover?(host: ToolHost, point: Point | null): string | null;
readonly commands?: C;   // C extends readonly ContributedCommand[], inferred by defineTool's const generic

// src/hooks/toolHost/ (moves to src/editor/canvas/ in stage 5)
export function createSurface(doc: SpriteDocument, layerId: string, frameId: string, recorder: StrokeRecorder): Surface;
export function createToolHost(deps: { doc: SpriteDocument; history: History }): ToolHost & { attachRenderer(r: CanvasRenderer | null): void };
export const ToolHostProvider: React.Provider<ToolHost>;
export function useToolHost(): ToolHost;
```

Tool sketches:

```ts
// pencil
onPointerDown(host, g) { g.surface.commit(stamp(g.surface, g.point, brush(host, g))); },
onPointerMove(host, g) { g.surface.commit(stampLine(g.surface, g.previous, g.point, brush(host, g))); },
// brush(host, g) = { color: host.colors.get(g.slot), size: host.tool.options().brushSize, mirror… }

// picker
onPointerDown(host, g) {
  const color = host.tool.options().pickFromComposite ? host.document.sampleComposite(g.point.x, g.point.y)
                                                      : g.surface.read(g.point.x, g.point.y);
  if (color) host.colors.set(g.slot, color);
},

// select: deactivate mid-move  →  state.drag?.surface.revert()
// select: edit.paste           →  host.history.edit("Paste", (s) => { rect = pasteInto(s, clipboard) }); host.tool.activate(); setSelection(rect)
```

## Files

- `src/framework/host.ts` and `src/framework/command.ts`: new. Serves 1-9.
- `src/framework/tool.ts`: new handler signatures. `ToolContext` and `ToolSession` are deleted, `commands` becomes definitions, and `defineTool` gets `const` generics. Serves 3, 9.
- `src/tools/shared/paint.ts`: `writePixel`, `stamp`, `stampLine` and `commitWrite` work on a `Surface`. Serves 2.
- `src/tools/{pencil,eraser,fill,picker}/tool.ts`: the new signatures. Serves 2, 4.
- `src/tools/select/`:
  - `tool.ts`: the six commands, and the surface pinned in the move drag; `revert()` on abandon.
  - `region.ts` and `clipboard.ts`: moved in and rewritten over buffers.
  - `overlay.ts`.

  Serves 2, 5-8, 11.
- `src/tools/index.ts`: `ContributedCommandId`. Serves 9.
- `src/hooks/toolHost/{surface,createToolHost,ToolHostContext}.ts`: new adapters. Serves 2, 5-8, 12.
- `src/hooks/usePointerPaint.ts`: builds `Gesture`s instead of `ToolContext`. `src/hooks/useToolLifecycle.ts`: `onActivate(host)`. Serves 3, 4.
- `src/components/editor/EditorPage.tsx`: `ToolHostProvider`. `src/components/editor/EditorCanvas.tsx`: `attachRenderer`. Serves 12.
- `src/commands/contributed.ts` (new), `src/commands/keymap.ts` (merges contributed keys), `src/commands/types.ts` (`CommandId`), and `src/commands/useEditorCommands.ts` (the six selection commands, `selection` and `hasClipboard` removed, contributions spread in). Serves 9, 10.
- `src/constants/commands.ts` and `src/constants/shortcuts.ts`: the six ids and bindings removed. Serves 9.
- `src/components/editor/ShortcutHelpDialog.tsx`: Decision 10.
- `.oxlintrc.json`: Decision 13.
- `tests/support/factories.ts`:
  - `fakeHost(overrides)`: plain objects, with spies where useful;
  - `makeGesture(doc, point, opts)`: a real `createSurface` over a real doc and recorder;
  - `makeToolContext` is removed.
- Docs:
  - `docs/architecture.md`: §9, plus a short "Tool host" subsection listing the five capabilities.
  - `docs/conventions.md` §1: "a tool reads the host only through `ToolHost`".
  - `docs/shortcuts.md` §Implementation contract: contributed commands.

## Test plan

Unit:

- `tests/unit/tools/tools.test.ts` uses `fakeHost()` + `makeGesture()`. Every existing assertion keeps its meaning (pixels written, mirror, clipping, eraser zeroes, fills, picker samples). Add: "a right-button gesture paints with the secondary colour", "the picker writes to the gesture's slot".
- `tests/unit/tools/select.test.ts`:
  - Assert through commands and a real surface instead of `selection.get()`: copy then paste, deselect, `isEnabled`, and one undo entry per move.
  - New: "deactivating mid-move reverts the pixels and records nothing".
- `tests/unit/tools/select/region.test.ts`: the moved region and clipboard tests, rewritten over buffers.
- New `tests/unit/toolHost/surface.test.ts`, against a real doc:
  - `buffer()` creates the cel, and its snapshot makes undo exact.
  - `commit(null)` is a no-op.
  - `revert()` restores and records nothing.
  - `read` is transparent outside the sprite or with no cel.
- New `tests/unit/commands/contributed.test.ts`:
  - The six ids are in the registry and in `SHORTCUTS` once each.
  - Paste activates select before selecting, so `edit.deselect` becomes enabled.
- `tests/unit/commands/keymap.test.ts`: the "no shared chord" test stays green.

Browser: every suite green and unchanged (`tools/*`, `core-editing`, the cheat sheet).

Command: `npm run lint && npm run build && npm run test:coverage`

## Done when

- [ ] 1. `grep -rnE "SpriteDocument|StrokeRecorder|History|useEditorStore|layerId|frameId" src/tools` is empty.
- [ ] 2. `ToolContext` and `ToolSession` no longer exist. Every tool callback takes `(host, …)`.
- [ ] 3. `grep -rn "export const selection\|@/core/selection\|@/core/clipboard\|@/core/commands/selection" src tests` is empty. `edit.copy` and the other five ids are defined only in `src/tools/select/`.
- [ ] 4. Drawing, erasing, fills, picker (left and right button), selection, move, ⌘-drag duplicate, copy/cut/paste/delete/select all/deselect, and undo/redo behave exactly as before.
- [ ] 5. `<CommandButton command="edit.copyy" />` is a type error, and lint rejects `import "@/tools/select/tool"` from `src/commands/useEditorCommands.ts` (probe both, then revert).
- [ ] 6. The command above passes.

## Open risks

- Derived `ContributedCommandId` through `const` generics in a heterogeneous `TOOL_LIST`
  tuple. Fallback: each tool exports its ids as a `const` tuple from its own folder. Log it.
- `history.edit` for Paste must push exactly one entry, with the label "Paste", and keep
  today's "paste lands at the copied position" behaviour. Pin both with the paste test.
- Per-pixel `surface.read` in loops is a monomorphic method call, which is fine at sprite sizes.
  Hot loops (flood fill, brush stamps) work on `buffer()` directly.

## Open questions for the maintainer

None. Decisions 1 and 2 were settled on 2026-10-01, and the rest follow from them.

## Drift log
