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

One line per folder: what belongs there. Individual files are not listed — they change too often
for a map to stay true. The dependency rules between these folders are in §9.

```
src/
  app/          routes, the app shell, providers, DocumentProvider (the open document's context),
                RouteErrorBoundary (a crashed page shows CrashPage instead of a blank screen)
  components/   React only. One folder per surface: editor/, manager/ (the library), builder/
                (the spritesheet composer), settings/, plus common/ (shared app components) and
                ui/ (generated shadcn primitives — add variants, never fork)
  hooks/        bridges React to everything below it: document revisions, DnD, pointer input,
                and the domain action hooks (useSpriteActions, usePaletteActions, …) that are the
                only way components reach the database, services and export
  commands/     the editor command registry: ids → run/enabled/active/label, the keymap merged
                from tool and app keys, and the gesture hints shown in tooltips
  stores/       zustand UI state: the editor store (built from slices/) and the builder's view store
  editor/       the imperative core, zero React: SpriteDocument, cels, pixels, history, renderer,
                viewport, overlays, command factories (commands/), and tools/ — one file per tool
                plus index.ts, the one registry every tool list derives from
  db/           Dexie schema and instance, repositories/ (the only code that queries tables),
                typed errors, seed data, whole-database backup
  services/     where db/ and editor/ meet: open/save a document, autosave, thumbnails, PNG import
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
types/      ──►  types from db/schema
editor/     ──►  lib, constants, types; types from commands/hints           lint (no React/DB/UI)
db/         ──►  lib, constants, types                                      lint (no editor/UI)
export/     ──►  editor, lib, constants, types; types from db/schema        lint (no React/UI)
services/   ──►  db, editor, export, lib, constants, types                  lint (no React/UI)
stores/     ──►  editor, lib, constants, types                              lint (no React/UI)
commands/   ──►  editor, stores, hooks, app (document context), lib, constants
hooks/      ──►  services, export, db/repositories, stores, editor, commands,
                 app (document context), lib, constants                     lint (no raw db, no components)
components/ ──►  hooks, stores, commands, editor, app (document context),
                 lib, constants, types; types from db/schema                lint (no db/services/export)
app/        ──►  everything
```

Reading it out loud: **pure things never import impure things, nothing below React imports React,
and components reach data only through hooks.** `editor/` staying React-free is what makes the
core testable with no DOM; hooks being the only door to `db/`, `services/` and `export/` is what
keeps loading, error reporting and toasts in one place per domain (§10).

Two edges are known compromises: hooks and commands read the open document through
`app/DocumentProvider`, and `editor/tools` borrows the hint *type* from `commands/`. Both are
type- or context-only; moving the document context below `app/` would remove the first.

## 10. Data access

One path from a click to the database and back:

```
component ──calls──► domain action hook ──► repository / service / export
    ▲                    │ success/failure → toast (runWithToast / useAsyncAction)
    └── useLiveQuery ◄───┴─ Dexie notifies every live query that read the rows it wrote
```

- **Reads** are live: a hook wraps `useLiveQuery` around a repository call (`useLibrary`,
  `usePalettes`, `useSpritesheet`), so a write anywhere re-renders every surface showing it.
  `undefined` from `useLiveQuery` means "not loaded yet" — keep it distinct from "empty".
- **Writes** go through a domain action hook (`useSpriteActions`, `useSpritesheetActions`,
  `usePaletteActions`, `useBackupActions`). The hook owns the user-facing message; components
  never build an error string or call `toast.error` for a failed write.
- **Optimistic order** (drag reorders) goes through `useOptimisticOrder`, which shows the proposed
  order until the live query catches up.
- **Errors**: repositories throw typed errors (`NotFoundError`, `QuotaError`); action hooks turn
  them into toasts; a render crash is caught by `RouteErrorBoundary`. User data that can be
  malformed (backups, palette files) is validated into a `Result` instead of throwing.

See [conventions.md](conventions.md) for the full code standard: file/function size limits,
naming, where a piece of logic belongs (hook vs util vs store vs core), barrel-file policy,
and the lint config that enforces it.
