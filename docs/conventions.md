# Code conventions

The code standard for this repo. It exists so the codebase stays readable at month six, not just
at week one. `.oxlintrc.json` enforces the mechanical parts (§10); the rest is for review.

## 1. Where does this code go?

Before writing anything, answer one question: *what does it depend on?*

| If it… | It goes in | Example |
| --- | --- | --- |
| is a literal value with no logic | `src/constants/` | `MAX_ZOOM`, `DEFAULT_FPS`, `BRUSH_SIZES` |
| is a pure function of its arguments | `src/lib/` | `hexToRgba()`, `rectUnion()`, `clamp()` |
| manipulates pixels/documents, no React, no DB | `src/editor/` | `floodFill()`, `SpriteDocument` |
| talks to IndexedDB | `src/db/repositories/` | `duplicateSprite()` |
| wires the DB to the editor core | `src/services/` | `autosave.ts`, `documentService.ts` |
| is cross-component UI state | `src/stores/` | active tool, primary color, zoom |
| bridges React to a non-React source | `src/hooks/` | `useDocumentRevision()` |
| is a user action that writes data | `src/hooks/use<Domain>Actions.ts` | `useSpriteActions().duplicate` |
| renders DOM | `src/components/` | `<LayersPanel/>` |

Two rules resolve almost every "where should this live" argument:

1. **Pure logic is a named function, not inline arithmetic** — hooks and components should read as
   a sequence of named calls. Colocate it with its only caller first; promote it to `lib/` (with
   a unit test) the moment a second caller needs it.
2. **If two components need it, it is not component state.** Lift it to a store or a hook — never
   to prop-drilling through three levels.

## 2. Size: review heuristics, not limits

Size is a symptom; mixed responsibilities are the problem. In review, a unit that trips one of
these gets asked "what are the two things this does?" — and is split along that answer, not at
an arbitrary line.

| Unit | Worth a look past | Usual fix |
| --- | --- | --- |
| File | ~200 lines | split by responsibility |
| React component | ~150 lines / ~6 hooks | extract a child component or a custom hook |
| Function | ~40 lines | extract named helpers |
| Function params | 3 (public APIs) | pass an options object with a named type |
| `useEffect` per component | 2 | move the logic into a custom hook |

## 3. Naming

```
Components         PascalCase.tsx           LayersPanel.tsx
Hooks              useThing.ts              useAnimationPlayer.ts
Stores             useXStore.ts             useEditorStore.ts
Core classes       PascalCase.ts            SpriteDocument (document.ts)
Utils / modules    camelCase                color.ts, paletteSort.ts
Constants          SCREAMING_SNAKE          DEFAULT_CANVAS_SIZE
Types              PascalCase               CelKey, ToolContext
Booleans           is/has/should/can        isDirty, hasSelection
Event handlers     handleX (local), onX (prop)
Async that hits DB verbs: load/save/create/duplicate/remove
```

Types over interfaces for unions and aliases; `interface` for object shapes that get extended
(`Tool`, `ToolContext`). Always `import type { … }` for type-only imports — `verbatimModuleSyntax`
is on and will error otherwise.

Two compiler settings shape how classes are written in this repo:

- **`erasableSyntaxOnly`** forbids constructor parameter properties (`constructor(private readonly
  doc: Doc) {}`) and enums. Declare fields explicitly and assign them in the constructor body.
- **Pixel buffers are `PixelBuffer`** (`src/types/pixels.ts`), i.e. `Uint8ClampedArray<ArrayBuffer>`.
  The default `Uint8ClampedArray` is backed by `ArrayBufferLike`, which `ImageData` rejects —
  and wrapping the cel buffer in `ImageData` without copying is load-bearing for the renderer.

## 4. Constants: no magic numbers, ever

Every tuning value in this app is user-visible behaviour (zoom feel, autosave latency, onion
opacity). They belong in one place per domain so they can be tuned without grepping.

One file per domain — `canvas.ts` (zoom ladder, canvas and grid sizes), `storage.ts` (autosave
debounce, thumbnail throttle, history caps, backup format version), `animation.ts`, `builder.ts`,
`names.ts` (default names), `shortcuts.ts`, and so on. Look there for the current values; they are
deliberately not repeated in this document.

Rules: constants files contain **no logic**, and import only other constants and types.
If a value needs computing, it is a `lib/` function, not a constant.

## 5. Modules and barrels

- Import from the file, not from a barrel: `import { floodFill } from '@/editor/pixels'`.
- The **only** barrels allowed are registries where the collection itself is the API:
  `editor/tools/index.ts` is the only one today.
  Everywhere else barrels create import cycles and defeat tree-shaking.
- Always use the `@/` alias. Relative imports only within the same folder (`./pixels`).
- One concept per file. `pixels.ts` exporting `plot`, `line`, `floodFill` is one concept
  (pixel primitives). A file exporting `floodFill` and `LayersPanel` is not.

## 6. React specifics

The React Compiler is enabled in `vite.config.ts`.

- **Do not** write `useMemo`, `useCallback` or `React.memo` by default. The compiler handles
  memoisation; hand-written memos add noise and can defeat it. Exception: a value passed into a
  non-React system (a renderer, an event listener) where identity is load-bearing — comment why.
- Components receive data via props or hooks, never by reaching into the document/renderer
  directly. Only `<EditorCanvas/>` talks to the `CanvasRenderer`; other canvases (thumbnails,
  previews, strips) are painted by a hook such as `useThumbnailCanvas` or `useSpriteStripCanvas`.
- No `useEffect` for derived state. Effects are for subscriptions, imperative sync, and cleanup.
  To reset state when a prop changes, adjust it during render or remount with a `key`.
- Every list that can change gets a stable `key` from a domain id — never an array index (frames
  and layers get reordered, and index keys will corrupt the UI state of the rows). A fixed list
  of placeholders (skeletons) is the one place an index key is fine.
- Components never import `db/`, `services/` or `export/` (types excepted): data comes from a
  hook, writes go through a domain action hook. See [architecture.md §10](architecture.md).
- A form in a dialog mounts only while open (`FormDialog`), so its draft starts fresh every time.
- Dialogs/menus come from `components/ui/` (shadcn). Do not hand-roll focus traps.

## 6b. UI composition: shadcn first

**Always build from the shadcn components in `src/components/ui/`, and write as little CSS as
possible.** The UI may look generic — the bar is clean and easy to navigate, not bespoke.

- Before writing a component, check whether a shadcn primitive covers it. If one exists but is
  not installed, install it (`npx shadcn@latest add card field badge context-menu alert-dialog
  command kbd …`) rather than rebuilding it out of `div`s.
- Utility classes are for **layout only** — `flex`, `grid`, `gap`, `size`, `min-w-0`, `truncate`.
  Colours, borders, radii, shadows, focus rings, hover and pressed states come from the
  component's own variants. A 12-class string on a `div` is a sign the wrong primitive is in use.
- Structure panels with `Card` / `CardHeader` / `CardContent`, rows with `Button` variants,
  labelled controls with `Field` + `Label`, menus with `DropdownMenu` / `ContextMenu`,
  destructive confirms with `AlertDialog`, key hints with `Kbd`.
- Custom markup is reserved for genuinely domain-specific surfaces that no design system covers:
  the canvas stack, colour swatch grids, frame/layer thumbnails. Even there, wrap them in
  shadcn containers and keep the bespoke classes to sizing and positioning.
- Never restyle a `ui/` component inline to make it look different. If a variant is missing, add
  it to the component's `cva` config so every use site gets it.

The components generated into `src/components/ui/` are the exception to the "don't hand-edit"
rule only for adding variants — never fork one into an app component.

## 6c. React Compiler traps (learned the hard way)

The compiler is on, and it infers what a value depends on. Two rules follow, and breaking
either produces a UI that silently never updates — no error, no warning.

**Never read mutable document fields during render.** `SpriteDocument` mutates in place and its
reference never changes, so a component that renders `doc.layers` gets memoised forever. Read
through `useDocumentSnapshot(doc)`, which derives an immutable snapshot keyed on the revision
counters:

```tsx
// ✗ renders once and never updates again
const { doc } = useDocumentSession();
return <ul>{doc.layers.map(...)}</ul>;

// ✓
const snapshot = useDocumentSnapshot(doc);
return <ul>{snapshot.layers.map(...)}</ul>;
```

**A `useMemo` dependency that the callback does not read is ignored.** The compiler derives
deps from the callback body, not from the array you wrote. A revision counter listed only in
the deps array invalidates nothing — it has to be *used* inside:

```ts
// ✗ never recomputes: the callback only reads `doc`, whose reference is constant
useMemo(() => ({ layers: doc.layers.map(copy) }), [doc, revision]);

// ✓ `revision` is read inside, so it is a real dependency
useMemo(() => ({ revision, layers: doc.layers.map(copy) }), [doc, revision]);
```

The same reasoning is why `SpriteDocument` **replaces** its `layers` and `frames` arrays instead
of splicing them. Pixel buffers stay mutable — that is the hot path — but these arrays are tiny
and their identity is what React uses to decide whether anything changed.

## 6d. Base UI composition traps

**`Tooltip.Trigger` swallows `onClick` on the element it renders.** The trigger injects its own
click handler, which replaces the one on your element — the button renders, looks fine, and does
nothing. Never write `<TooltipTrigger render={<Button onClick={…} />} />`; use the shared
`<TooltipButton>`, which keeps the Button as a real child of a wrapper trigger.

**`<Button render={<Link/>}>` needs `nativeButton={false}`.** Without it Base UI warns and the
element loses native button semantics.

**`<SelectValue>` renders the raw value, not the item label.** Pass a children function that maps
the value back to a label.

## 7. Custom hook shape

A hook returns either a value, or one object with a flat, named API — never a positional tuple
of more than two.

```ts
// src/hooks/useAnimationPlayer.ts
export interface AnimationPlayer {
  isPlaying: boolean;
  frameIndex: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
}
export function useAnimationPlayer(options: AnimationPlayerOptions): AnimationPlayer { … }
```

Hooks own subscriptions and cleanup; they do not own algorithms. `useFloodFill` would be wrong —
flood fill is `editor/pixels.ts`, the hook would only wire it to state.

## 8. Errors and edge cases

- Repository functions throw typed errors (`NotFoundError`, `QuotaError`). `get*` throws when the
  row is missing; `find*` returns `undefined` where absence is an expected state.
- A user-triggered write reports its outcome through `runWithToast` / `useAsyncAction` in its
  domain action hook — one message per failure, written once, never in the component.
- A render error is caught by `RouteErrorBoundary`, which shows `CrashPage`. No silent `catch {}`.
- Anything that can fail on user data (import a backup, parse a palette file) returns a
  discriminated result instead of throwing:
  ```ts
  export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
  ```
- Every repository write goes through `withQuotaGuard` — quota is the one runtime failure users
  will actually hit.

## 9. Comments

Comment *why*, never *what*. The code says what. Three places where a comment is mandatory:

1. A non-obvious performance trick (`ImageData` sharing a buffer with the cel array).
2. A browser quirk workaround (premultiplied alpha, pointer capture, Safari `OffscreenCanvas`).
3. A deliberate deviation from these conventions.

## 10. Lint rules that enforce the above

The source of truth is [`.oxlintrc.json`](../.oxlintrc.json) — read it rather than a copy here,
which would drift. What it enforces, in intent:

- **Layer boundaries** (`no-restricted-imports` overrides per folder): `editor/` is framework-free;
  `db/` never imports the editor or UI; `lib/` and `constants/` are pure; `services/`, `export/`
  and `stores/` never import React code; `commands/` never reach the database or components; `types/`
  holds types only; `hooks/` never touch the raw Dexie instance or import components; `components/` never import `db/`, `services/`, `export/` or Dexie (type-only
  imports allowed). The table in [architecture.md §9](architecture.md) marks which edges these
  cover.
- **Hooks and imports**: `rules-of-hooks`, `consistent-type-imports`, `no-explicit-any`, `import/no-cycle`.
- **Design system**: `shadcn/no-restyle` — a `ui/` component is never restyled inline; add a
  variant to its `cva` config instead (§6b).

A disable comment must name a rule that is actually enabled, and say why.

## 11. Testing

- **Tests never sit next to the file they cover.** They live under `tests/`, mirroring `src/`
  one level down: `src/editor/history.ts` → `tests/unit/editor/history.test.ts`. Do not
  colocate `*.test.ts` files next to their source.
- **Two Vitest projects, chosen by one question:** does the code under test import React, touch
  the DOM, or read a canvas? No → `tests/unit/**` (jsdom, `*.test.ts`). Yes → `tests/browser/**`
  (real Chromium via the Playwright provider, `*.browser.test.tsx`). See
  [phase 12 §12.2](phases/phase-12-test-infrastructure.md) for why jsdom cannot stand in for a
  real canvas here, and [phase 13 §13.2](phases/phase-13-test-coverage.md) for the coverage plan.
- **A test file holds assertions and fixtures only.** No prose, no comment block explaining why a
  behavior is worth testing — that belongs in the phase doc that introduced the behavior. The
  three cases in §9 (a perf trick, a browser-quirk workaround, a deliberate convention deviation)
  are the only comments a test file earns, same as anywhere else in the codebase.
- Shared test helpers (`factories.ts`, `render.tsx`, setup files) live in `tests/support/` and
  are imported via the `@test/*` alias, never via relative paths that climb out of `tests/`.
- Prefer asserting on the model (`doc.getCel(...)`, store state) over pixels rendered to screen or
  screenshots — it's exact and needs no `waitFor`. Reach for a real interaction/visual assertion
  only when the thing under test is the rendering itself, not the logic behind it.
- **Editor tests go through `@test/editor`.** `openEditor()` renders the real app at a fresh
  sprite in a fixed-size viewport and returns `click`/`drag`/`hover` in sprite-pixel space;
  `paintedPixels`, `pixelAt` and `compositeAt` read the result back from the live document.
  Choose tools, layers and frames the way a user does (`chooseTool`, `selectLayer`,
  `selectFrame`, or the keys) rather than by setting the store.
- **Drag tests never measure a bare `querySelector`.** Take sources and targets from `settled()`
  (`@test/dom`), which waits until the element exists and has stopped moving: live queries render
  a beat after the page and shift everything around them. Release drags that open a slot under the
  pointer with `settleMoves` (built into `holdDrag`), because dnd-kit only re-measures on a later
  move.
- **Every browser test file gets its own IndexedDB** (see `tests/support/setup.browser.ts`), since
  files run in parallel on one origin. Don't open `DB_NAME` by hand in a test.
- **CI** (`.github/workflows/ci.yml`) runs lint, `tsc -b` + build, and both projects with the
  coverage floor on every pull request, and the Pages deploy runs it before building. Locally,
  `npm run lint`, `npm run build` and `npm run test:coverage` are exactly what CI runs.
