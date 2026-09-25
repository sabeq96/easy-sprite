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
| [conventions.md](conventions.md) | Code standard: module boundaries, where code belongs, shadcn-first UI rule, naming, size limits, lint enforcement |
| [shortcuts.md](shortcuts.md) | The full keymap, the command registry contract, and conflict rules |

## Status

All fourteen phases are implemented and verified. `npm run dev` gives a working editor, and both
the editor core and the UI layer around it (components, hooks, stores) now have real test
coverage.

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run build` (runs `tsc -b`) | clean |
| Lint, incl. layering rules | `npm run lint` | clean |
| Unit tests (jsdom) | `npm run test` | 158 passing |
| Browser tests (real Chromium) | `npm run test:browser` | 19 passing |
| Both projects | `npm run test:all` | 177 passing |
| Coverage gate | `npm run test:coverage` | ~78% lines / ~84% branches, above the 70/60 floor |

`npm run test:browser` and `test:all` need a Chromium binary that isn't installed by `npm
install`: run `npx playwright install chromium` once per machine (it downloads outside the npm
dependency graph, into `~/Library/Caches/ms-playwright` on macOS).

There is also a VS Code launch config (`.vscode/launch.json`): **Debug app in Chrome** attaches
source-mapped breakpoints to the running dev server, and two vitest configs debug the test suite.
The `window.__spriteEditor` handle (dev builds only, set in `DocumentProvider`) exposes the live
`doc` and `history` for console and debugger inspection — both interactively and from
`tests/browser/**`, which reads it to assert on real pixel state instead of the DOM.

`scripts/smoke.mjs`, the ad hoc Puppeteer script phases 0–11 relied on for a manual end-to-end
check, is gone: `tests/browser/flows/core-editing.browser.test.tsx` and
`tests/browser/flows/sprite-manager.browser.test.tsx` cover the same ground with real assertions
that run in `npm run test:all`, not a screenshot someone has to look at.

### Corrections made during implementation

A few things in the plans below were wrong, and the code is the source of truth where they differ:

1. **`shadcn` is a runtime dependency**, not an install accident — `src/index.css` imports its
   Tailwind layer. See the decision log above.
2. **Document structure arrays are immutable.** The plan had `SpriteDocument` splice its
   `layers`/`frames` in place. With the React Compiler that makes panels render once and never
   update, because the array reference never changes. They are now replaced on every structural
   edit, and components read through `useDocumentSnapshot`. See
   [conventions.md §6c](conventions.md).
3. **Tooltip buttons need a wrapper trigger.** `<TooltipTrigger render={<Button onClick/>} />`
   silently drops the handler; all icon buttons go through `<TooltipButton>`. See
   [conventions.md §6d](conventions.md).
4. **`DocumentProvider` takes a `spriteId`, not a `doc`.** Phase 12's sketch assumed the provider
   accepted a live document directly; the real component owns loading by id (`fallback`,
   `renderError`), so component tests that need one seed a sprite through the real repository and
   render the real route instead of injecting a fake session.
5. **`ConfirmDialog`'s trigger isn't always a real `<button>`.** `LibraryItemMenu` passes it a
   `DropdownMenuItem`, so the Base UI trigger needs `nativeButton={false}` there and `true` (the
   default) everywhere else — another instance of the conventions.md §6d trap, caught by the
   sprite-manager flow test.
6. **Vitest Browser Mode needs Tailwind's own Vite plugin**, not just the CSS import. Without it,
   dialog overlays have no z-index/positioning and silently intercept clicks meant for their own
   content — see [phase 12 §12.5](phases/phase-12-test-infrastructure.md).

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
| 12 | Test infrastructure: browser mode & test tree | [phase-12-test-infrastructure.md](phases/phase-12-test-infrastructure.md) | all | 1 d |
| 13 | Component, interaction & flow coverage | [phase-13-test-coverage.md](phases/phase-13-test-coverage.md) | 12 | 2 d |
| 14 | Spritesheet composer: row layout, zoom & responsive shell | [phase-14-spritesheet-editor.md](phases/phase-14-spritesheet-editor.md) | 9, 10 | 1.5 d |

**Critical path:** 0 → 1 → 2 → 3 → 4. After phase 4 you have a usable single-frame editor.
Phases 6–9 are largely parallelisable if more than one person works on it. Phases 12–13 don't
block M1–M3 below; they close the coverage gap the milestones left behind.

### Milestones

- **M1 — "It draws" (phases 0–4).** One sprite, one layer, one frame, pencil/eraser/fill,
  undo/redo, persisted to IndexedDB across reloads.
- **M2 — "It animates" (phases 5–7).** Layers, frames, onion skin, playback.
- **M3 — "It ships" (phases 8–11).** Palettes, library, export, backup, full keymap, polish.
- **M4 — "It's proven" (phases 12–13).** Every layer has real coverage — including the canvas,
  the tool sidebar, dialogs and shortcuts — running in `npm run test:all`, and `scripts/smoke.mjs`
  is replaced by an assertion-based flow suite.

## Decision log

Locked-in choices, with the condition that would justify revisiting them. Everything here is
argued in full where it is implemented; this table is the short version.

| Decision | Why | Revisit if |
| --- | --- | --- |
| Keep the `shadcn` npm package as a dependency | Not an install accident: `src/index.css` does `@import "shadcn/tailwind.css"`, which is the base-nova style layer. Removing it breaks the production build. The CLI is still invoked as `npx shadcn@latest add …`. | the style layer is vendored into `index.css` |
| UI is shadcn-first, minimal custom CSS | Hand-rolled markup drifts from the design system and produces inconsistent spacing, focus and a11y behaviour. Generic-but-clean beats bespoke. See [conventions.md §6b](conventions.md). | never |
| Keep the `cn` npm package | The base-nova shadcn style generates `import { cn } from "cn"` (see `src/components/ui/button.tsx`). Rewiring it to `@/lib/utils` means hand-patching every future `npx shadcn add`. `@/lib/utils` re-exports `cn`, so app code has one import path and generated code still compiles. | shadcn changes its generated import, or you stop generating components |
| Drop `init` and `npx` from `dependencies` | Install-time accidents that ship nothing to the bundle and are imported by nothing. `shadcn` is **not** in this list — see the row above. | never — run `npm remove init npx` in phase 0 |
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
