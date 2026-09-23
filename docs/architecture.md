# Architecture

## 1. The one decision everything else follows from

A 64×64 sprite with 8 frames and 3 layers is 24 cels × 16 KB = ~400 KB of pixels. Painting a
stroke touches thousands of pixels per second. **React must never re-render because a pixel
changed.**

So the app has two state systems that are deliberately kept apart:

```
┌─────────────────────────────── React tree ────────────────────────────────┐
│  UI state (zustand)          Structure state (SpriteDocument + revisions)  │
│  tool, colors, zoom,         layer list, frame list, names, opacity, size  │
│  grid on/off, onion cfg      → React re-renders on these (they're rare)    │
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

Everything under `src/editor/` is framework-free and unit-testable without a DOM renderer.
Everything under `src/components/` is React and holds no pixel data.

One consequence is easy to get wrong: because the document mutates in place, React components
must never read its fields during render. They go through `useDocumentSnapshot`, and the
document replaces its `layers`/`frames` arrays rather than splicing them. See
[conventions.md §6c](conventions.md).

## 2. Folder map

```
src/
  app/
    routes.tsx              # declarative <Routes>
    AppLayout.tsx           # shell: top bar + <Outlet/>
    providers.tsx           # theme, document context, shortcut scope
  components/
    ui/                     # shadcn primitives (generated, do not hand-edit)
    editor/                 # Toolbar, ToolOptions, LayersPanel, FramesBar,
                            # PreviewPanel, PalettePanel, StatusBar, EditorCanvas
    manager/                # SpriteGrid, SpriteCard, NewSpriteDialog
    common/                 # ColorSwatch, NumberField, IconButton, ConfirmDialog
  editor/                   # ── imperative core, zero React imports ──
    emitter.ts              # tiny typed event emitter
    pixels.ts               # plot/line/flood-fill/blend on raw buffers
    cel.ts                  # Cel: buffer + ImageData + OffscreenCanvas
    document.ts             # SpriteDocument: layers, frames, cels, revisions
    history.ts              # Command stack, StrokeRecorder
    composite.ts            # layer compositing + onion skin passes
    viewport.ts             # zoom/pan math, screen↔sprite coordinate mapping
    renderer.ts             # canvas stack, rAF loop, dirty-rect redraw
    selection.ts            # lift/stamp helpers for moving a rect of pixels
    tools/                  # types.ts + one file per tool + index.ts (TOOL_LIST, the only list of
                            # tools; ToolId, tool commands, their keys and sidebar sections derive
                            # from it). A tool declares its key, hold key and gesture hints, and
                            # owns its state via onActivate → cleanup (the selection lives in
                            # tools/select.ts). Adding a tool: its file, TOOL_LIST, its icon.
  db/
    schema.ts               # record types (the persisted shape)
    db.ts                   # Dexie instance + versions
    repositories/           # sprites.ts, palettes.ts, settings.ts, cels.ts
    seed.ts                 # built-in palettes on first run
    backup.ts               # export/import whole DB as JSON
  services/                 # composition layer: the only place db/ and editor/ meet
    documentService.ts      # snapshot → SpriteDocument, and back
    autosave.ts             # debounced flush of dirty cels
    thumbnails.ts           # throttled thumbnail regeneration
  export/
    spritesheet.ts          # compose + encode PNG
    download.ts             # blob → file
  hooks/
    useDocument.ts          # context access
    useDocumentRevision.ts  # useSyncExternalStore bridge
    useAnimationPlayer.ts
    useShortcuts.ts
    usePointerPaint.ts      # pointer events → tool calls
  commands/                 # useEditorCommands (id → run/enabled/active/label), keymap.ts (tool +
                            # app keys merged), hints.ts (gesture hints), CommandsContext (useCommand,
                            # read by components/common/CommandButton)
  stores/
    useEditorStore.ts       # zustand: tool + options + colors + view prefs
    useCommands.ts          # command registry (id → run/enabled/label)
  lib/                      # pure utils: color.ts, rect.ts, id.ts, array.ts, math.ts, cn.ts
  constants/                # frozen config: tools.ts, shortcuts.ts, canvas.ts,
                            # palettes.ts, storage.ts, export.ts — no logic, no imports
  types/                    # shared domain types (non-persisted)
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
well inside IndexedDB quota; the editor warns above it (phase 9).

## 4. Rendering pipeline

Four stacked `<canvas>` elements, identical CSS box, `position:absolute`, painted in one rAF:

| z | Canvas | Redrawn when | Contents |
| --- | --- | --- | --- |
| 0 | `checker` | viewport changes | transparency checkerboard (CSS gradient div, not canvas) |
| 1 | `onion` | frame/onion config changes | previous/next frame composites, tinted + faded |
| 2 | `main` | any dirty cel, frame or layer change | composite of visible layers of current frame |
| 3 | `overlay` | pointer move, active tool's state, grid toggle | grid, active tool's persistent overlay (e.g. the selection), brush preview |

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

`Viewport { scale, originX, originY }` lives in the editor store (UI state — it is allowed to
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
- An `AutosaveController` flushes on a 700 ms debounce, on `visibilitychange`, on route change,
  and on `beforeunload` (best-effort), in one `db.transaction('rw', ...)` per flush.
- Thumbnails regenerate at most every 5 s while editing.
- The sprite gallery reads through `useLiveQuery`, so saves show up there with no manual wiring.

IDs are `crypto.randomUUID()` strings, not auto-increment integers, so JSON backups can be
re-imported without remapping foreign keys.

## 8. Testing strategy

Vitest + jsdom for the core; the core is pure functions over typed arrays, which is the easy 80%.

- `pixels.test.ts` — plot/line/flood fill/blend against hand-written expected buffers.
- `history.test.ts` — stroke → undo restores byte-identical buffer.
- `document.test.ts` — structural ops keep cel map consistent (no orphan cels).
- `backup.test.ts` — export → import round-trips to an identical DB dump.
- `spritesheet.test.ts` — frame rects for each layout mode.

Canvas-dependent code (`renderer.ts`) is verified by hand; `OffscreenCanvas` is stubbed in tests.

## 9. Module boundaries

The dependency graph is a DAG with exactly one legal direction. Anything that violates it is a
bug, not a style opinion, and phase 0 wires a lint rule to fail the build on it.

```
constants/  ──►  (nothing)
lib/        ──►  constants, types
types/      ──►  (nothing)
editor/     ──►  lib, constants, types              ✗ never React, Dexie, components
db/         ──►  lib, constants, types              ✗ never editor, components
export/     ──►  editor, lib, constants, types
services/   ──►  db, editor, lib, constants, types     ◄ the only layer that may touch both
stores/     ──►  editor, lib, constants, types
hooks/      ──►  services, stores, db, editor, lib, constants
components/ ──►  hooks, stores, lib, constants, types, components/ui
app/        ──►  everything
```

Reading it out loud: **pure things never import impure things, and nothing below React imports
React.** `editor/` staying React-free is what makes the whole core testable in Vitest with no
DOM, and what stops rendering logic from leaking into components.

See [conventions.md](conventions.md) for the full code standard: file/function size limits,
naming, where a piece of logic belongs (hook vs util vs store vs core), barrel-file policy,
and the lint config that enforces it.
