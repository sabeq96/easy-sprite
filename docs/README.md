# Sprite Editor — Implementation Plan

A browser-based pixel-art editor and animator (a focused Piskel clone), built on the
stack already scaffolded in this repo: **React 19 + Vite 8 + TypeScript + Tailwind 4 +
shadcn (base-nova/base-ui) + react-router 8 (declarative) + Canvas 2D + IndexedDB (Dexie 4)**.

Everything is local-first: no server, no account, no network calls. The whole database can be
exported to a single JSON file and imported back.

## Scope

| Area | In scope |
| --- | --- |
| Drawing | pencil (sizable) + mirror pencil, eraser, paint bucket, color picker, rectangular selection, move/copy |
| Structure | layers (visibility, opacity, lock, reorder, merge), frames (add/duplicate/reorder/delete) |
| Animation | live preview, FPS control, loop, onion skinning (before/after count + tint) |
| Color | palettes (built-in + user-defined, saved to IndexedDB), primary/secondary color, hotkeys |
| Canvas | configurable size, resize/crop, zoom/pan, pixel grid toggle, checkerboard transparency |
| Library | sprite manager: gallery, search, tags, rename/duplicate/delete, thumbnails |
| Export | spritesheet PNG (columns/scale/padding), single-frame PNG, full-DB JSON backup + restore |
| Input | Piskel-like keyboard shortcuts for tools, undo/redo, colors, frames, zoom |

Explicitly **out of scope**: GIF export, cloud sync, collaboration, vector tools, text tool.

## Reference documents

| Doc | What it is |
| --- | --- |
| [architecture.md](architecture.md) | System design: state ownership, rendering pipeline, memory/perf budget, folder map |
| [conventions.md](conventions.md) | Code standard: module boundaries, where code belongs, naming, size limits, lint enforcement |
| [shortcuts.md](shortcuts.md) | The full keymap, the command registry contract, and conflict rules |

## Phases

Each phase is a self-contained, shippable slice with its own doc: goal, files touched, full
code for the non-obvious parts, and a **Done when** checklist you can actually verify in the
browser. Phases are ordered by dependency — do not reorder 1→4.

| # | Phase | Doc | Depends on | Est. |
| --- | --- | --- | --- | --- |
| 0 | Foundation & app shell | [phase-00-foundation.md](phases/phase-00-foundation.md) | — | 0.5 d |
| 1 | Data layer (Dexie schema + repositories) | [phase-01-data-layer.md](phases/phase-01-data-layer.md) | 0 | 1 d |
| 2 | Document runtime, history, autosave | [phase-02-document-runtime.md](phases/phase-02-document-runtime.md) | 1 | 1.5 d |
| 3 | Canvas renderer & viewport | [phase-03-renderer.md](phases/phase-03-renderer.md) | 2 | 1.5 d |
| 4 | Drawing tools (pencil/mirror/eraser/fill/picker) | [phase-04-tools.md](phases/phase-04-tools.md) | 3 | 2 d |
| 5 | Selection, move & clipboard | [phase-05-selection.md](phases/phase-05-selection.md) | 4 | 1 d |
| 6 | Layers | [phase-06-layers.md](phases/phase-06-layers.md) | 2, 3 | 1 d |
| 7 | Frames, animation preview, onion skin | [phase-07-animation.md](phases/phase-07-animation.md) | 6 | 1.5 d |
| 8 | Color & palettes | [phase-08-palettes.md](phases/phase-08-palettes.md) | 1, 4 | 1 d |
| 9 | Sprite manager & canvas settings | [phase-09-sprite-manager.md](phases/phase-09-sprite-manager.md) | 1 | 1 d |
| 10 | Export: spritesheet PNG + JSON backup | [phase-10-export-backup.md](phases/phase-10-export-backup.md) | 2, 9 | 1 d |
| 11 | Shortcuts, command palette, polish, perf | [phase-11-shortcuts-polish.md](phases/phase-11-shortcuts-polish.md) | all | 1.5 d |

**Critical path:** 0 → 1 → 2 → 3 → 4. After phase 4 you have a usable single-frame editor.
Phases 6–9 are largely parallelisable if more than one person works on it.

### Milestones

- **M1 — "It draws" (phases 0–4).** One sprite, one layer, one frame, pencil/eraser/fill,
  undo/redo, persisted to IndexedDB across reloads.
- **M2 — "It animates" (phases 5–7).** Layers, frames, onion skin, playback.
- **M3 — "It ships" (phases 8–11).** Palettes, library, export, backup, full keymap, polish.

## Decision log

Locked-in choices, with the condition that would justify revisiting them. Everything here is
argued in full where it is implemented; this table is the short version.

| Decision | Why | Revisit if |
| --- | --- | --- |
| Keep the `cn` npm package | The base-nova shadcn style generates `import { cn } from "cn"` (see `src/components/ui/button.tsx`). Rewiring it to `@/lib/utils` means hand-patching every future `npx shadcn add`. `@/lib/utils` re-exports `cn`, so app code has one import path and generated code still compiles. | shadcn changes its generated import, or you stop generating components |
| Drop `init`, `npx`, `shadcn` from `dependencies` | Install-time accidents. `shadcn` is a CLI (`npx shadcn@latest add …`), the other two are unrelated packages that ship nothing to the bundle. | never — run `npm remove init npx shadcn` in phase 0 |
| Dexie 4 for IndexedDB | Typed `EntityTable` collections, typed compound indexes, schema versioning, and `useLiveQuery` for a gallery that updates itself. | the app ever needs sync/replication — then RxDB |
| Raw RGBA in IndexedDB, not PNG | PNG round-trips through premultiplied alpha and silently mutates translucent pixels. Lossless beats small for source data. | sprites routinely exceed the ~48 MB budget; then compress cels with `deflate-raw` on write |
| Pixels never re-render React | Drawing writes to typed arrays and emits dirty rects; React only subscribes to structure/meta revision counters. | never — this is the architecture |
| zustand, sliced | Selector subscriptions keep a colour change from re-rendering the frames bar; slices keep each concern in its own file. | the store outgrows ~5 slices, which would mean state belongs in the document instead |
| One stroke = one undo step | Matches user expectation and keeps history proportional to what changed, not to canvas size. | never |
| No floating-selection mode | Cut + overlay + stamp inside one stroke removes a whole class of half-committed-state bugs. | shape/lasso selection lands and needs a persistent float |
| Dark theme by default | Pixel art is judged against a neutral dark surface; it is what every editor in this category does. | user preference says otherwise — it is a toggle, not a lock |
| No GIF export | Out of scope by request. Spritesheet PNG + frame rect JSON covers engine workflows. | users ask for shareable previews |

## How to use these docs

- Code blocks are the intended implementation, not pseudocode. Paths are given above each block.
- Where a decision was made between plausible options, the doc states the alternative and why it
  lost — if you disagree, that is the paragraph to argue with before writing code.
- Each phase ends with a **Done when** list. Treat it as the acceptance test; do not start the
  next phase with items unchecked, because later phases assume those invariants.
