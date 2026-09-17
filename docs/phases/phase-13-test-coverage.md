# Phase 13 — Component, interaction & flow coverage

**Goal:** spend the infrastructure phase 12 built. Fill `tests/browser/**` with the coverage the
UI layer has never had, add the handful of pure-logic gaps to `tests/unit/**`, and retire
`scripts/smoke.mjs` in favor of a `tests/browser/flows/` suite that runs the same critical path
with real assertions instead of a screenshot diff.

**Est.** 2 days · **Depends on:** 12

---

## 13.1 Coverage matrix

What exists today, what's missing, and which project each gap belongs in:

| Area | Example files | Project | What a test must prove |
| --- | --- | --- | --- |
| Stores (no canvas) | `stores/slices/viewSlice.ts`, `toolSlice.ts`, `colorSlice.ts` | unit | Reducers compute the right next state — zoom clamps to the container, `toggleGrid` flips a bool. Pure functions over a zustand slice; no DOM needed. |
| Hooks bridging to the DOM | `useCanvasRenderer`, `useShortcuts`, `useAnimationPlayer`, `useTheme` | browser | Subscriptions attach/detach correctly, effects run in a real event loop, `matchMedia`/`localStorage` behave like production. |
| Canvas drawing | `EditorCanvas` + `editor/tools/*` end to end | browser | A real pointer drag with the pencil tool paints the pixels `floodFill`/`plot` (already unit-tested) say it should — the seam between tool math and the renderer. |
| Dialogs | `ExportDialog`, `ResizeCanvasDialog`, `ConfirmDialog`, `NewSpriteDialog` | browser | Opens via its trigger, validates input, calls the right command on confirm, is cancelable without side effects. |
| Panels | `LayersPanel`, `FramesBar`, `PalettePanel`, `ToolSidebar` | browser | Add/duplicate/delete/select actions dispatch the right command and the active row reflects store state. |
| Shortcuts & command registry | `useShortcuts`, `useEditorCommands`, `CommandPalette` | browser | Every chord in `SHORTCUTS` fires its command; typing in an `<input>` never triggers one; `⌘K` opens the palette and search filters it. |
| Export | `export/spritesheet.ts` (math — already unit-tested), `ExportDialog` (flow) | unit + browser | Layout math stays a pure unit test; the dialog test proves the button click produces a `Blob` with the right dimensions, without touching the filesystem (§13.4). |
| Accessibility | icon buttons, `EditorCanvas`, toggles | browser | `aria-label`/`aria-pressed` are present and correct; `prefers-reduced-motion` disables the marching-ants animation. |
| Critical path | the whole app | browser (flow) | Replaces `scripts/smoke.mjs` — see §13.5. |

## 13.2 Unit vs. browser: the one-question test

Before writing a test, ask: **does the code under test import React, touch the DOM, or read a
canvas?** No → `tests/unit/**`, jsdom, fast. Yes → `tests/browser/**`, real Chromium. A zustand
slice is plain JavaScript with no DOM dependency, so it's a unit test even though a React
component reads it. A hook that calls `document.addEventListener` is a browser test even though
it never renders JSX.

## 13.3 Filling the unit gap first

Two pure areas currently have no test at all and don't need a browser:

`tests/unit/stores/viewSlice.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import { createViewSlice, type ViewSlice } from "@/stores/slices/viewSlice";

function makeStore() {
  return createStore<ViewSlice>()((set, get, api) => createViewSlice(set, get, api));
}

describe("viewSlice", () => {
  it("clamps zoom to the container once one is known", () => {
    const store = makeStore();
    store.getState().fitToContainer({ width: 320, height: 320 }, { width: 32, height: 32 });
    const before = store.getState().viewport;

    store.getState().zoom({ x: 160, y: 160 }, 1, { width: 32, height: 32 });
    expect(store.getState().viewport.scale).toBeGreaterThan(before.scale);
  });

  it("toggleGrid flips gridEnabled", () => {
    const store = makeStore();
    const initial = store.getState().gridEnabled;
    store.getState().toggleGrid();
    expect(store.getState().gridEnabled).toBe(!initial);
  });
});
```

`tests/unit/lib/keys.test.ts` — `matchesBinding`/`formatBinding` from phase 11 (`src/lib/keys.ts`)
are pure and were never covered:

```ts
import { describe, expect, it } from "vitest";
import { formatBinding, matchesBinding } from "@/lib/keys";

function keyEvent(init: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

describe("matchesBinding", () => {
  it("requires every modifier to match, not just the key", () => {
    const binding = { key: "z", mod: true, shift: true };
    expect(matchesBinding(keyEvent({ key: "z", metaKey: true, shiftKey: true }), binding)).toBe(true);
    expect(matchesBinding(keyEvent({ key: "z", metaKey: true }), binding)).toBe(false);
  });
});

describe("formatBinding", () => {
  it("renders a single-letter key uppercase", () => {
    expect(formatBinding({ key: "g", mod: true })).toMatch(/G$/);
  });
});
```

Repeat the same audit (`grep -L "test" $(find src/lib src/stores -name '*.ts')`) for anything
else in `lib/`/`stores/` that slipped through — this phase's unit portion is a cleanup pass, not
new architecture.

## 13.4 Browser interaction tests

### Drawing through the real renderer

`tests/browser/interactions/pencil-stroke.browser.test.tsx`

```tsx
import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { render } from "@test/render";
import { EditorPage } from "@/components/editor/EditorPage";
import { makeDocument } from "@test/factories";
import { DocumentProvider } from "@/app/DocumentProvider";

test("dragging with the pencil tool paints along the path", async () => {
  const doc = makeDocument({ width: 16, height: 16 });
  const screen = render(
    <DocumentProvider doc={doc}>
      <EditorPage />
    </DocumentProvider>,
  );

  const canvas = screen.getByRole("application", { name: "Sprite canvas" });
  const box = canvas.element().getBoundingClientRect();

  await userEvent.pointer([
    { target: canvas, coords: { x: box.width / 2, y: box.height / 2 } },
    { keys: "[MouseLeft>]" },
    { coords: { x: box.width / 2 + 20, y: box.height / 2 } },
    { keys: "[/MouseLeft]" },
  ]);

  const cel = doc.getCel(doc.layers[0].id, doc.frames[0].id);
  expect(cel?.pixels.some((channel) => channel !== 0)).toBe(true);
});
```

Reading the painted pixel through `doc.getCel(...)` rather than a screenshot keeps the assertion
exact and fast — this is the same document instance the component renders from, so it needs no
`waitFor`. Prefer this pattern (assert on the model, not on pixels rendered to screen) for every
drawing test; save actual pixel/visual comparison for the rare case a test is specifically about
rendering, not tool logic — already covered by the unit tests for `plot`/`floodFill` themselves.

### Dialogs and exports without touching the filesystem

`downloadBlob` (`src/export/download.ts`) creates an object URL and clicks a synthetic anchor —
real in production, but a real download in a headless test either does nothing observable or
depends on browser download-manager plumbing that has nothing to do with the app. Intercept at
the same seam the unit tests already trust:

`tests/browser/components/ExportDialog.browser.test.tsx`

```tsx
import { expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { render } from "@test/render";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { makeDocument } from "@test/factories";

test("Export PNG produces a blob sized to the spritesheet layout", async () => {
  const doc = makeDocument({ width: 8, height: 8 });
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");

  const screen = render(
    <ExportDialog doc={doc} open onOpenChange={() => {}} />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Export PNG" }));

  expect(createObjectURL).toHaveBeenCalledTimes(1);
  const [blob] = createObjectURL.mock.calls[0] as [Blob];
  expect(blob.type).toBe("image/png");
  expect(blob.size).toBeGreaterThan(0);
});
```

### Shortcuts never fire while typing

`tests/browser/hooks/useShortcuts.browser.test.tsx`

```tsx
import { expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { render } from "@test/render";
import { useShortcuts } from "@/hooks/useShortcuts";
import type { CommandRegistry } from "@/commands/types";

function Harness({ commands }: { commands: CommandRegistry }) {
  useShortcuts(commands);
  return <input aria-label="Sprite name" defaultValue="Hero" />;
}

test("typing 'z' in a text field does not trigger undo", async () => {
  const undo = vi.fn();
  const commands: CommandRegistry = {
    "edit.undo": { id: "edit.undo", label: "Undo", group: "Edit", run: undo },
  };
  const screen = render(<Harness commands={commands} />);

  await userEvent.click(screen.getByLabelText("Sprite name"));
  await userEvent.keyboard("z");

  expect(undo).not.toHaveBeenCalled();
});
```

## 13.5 Replacing `scripts/smoke.mjs`

`tests/browser/flows/core-editing.browser.test.tsx` walks the same steps as the Puppeteer script,
one `test()` per section, asserting on the DOM and the document model instead of `console.log`
and a screenshot diff:

| `scripts/smoke.mjs` section | Flow test | Assertion instead of a screenshot |
| --- | --- | --- |
| Draw with pencil, undo, redo | `test("pencil, undo, redo")` | painted pixel count via `doc.getCel(...)`, not `countPaintedPixels()` read back from canvas |
| Bucket fill | `test("bucket fills the enclosed region")` | pixel count increases past the stroke's own footprint |
| Add layer, duplicate frame | `test("layers and frames panels reflect document structure")` | `getAllByRole("listitem")` count in each panel |
| Select all, delete, undo | `test("select all + delete clears, undo restores")` | same pixel-count assertions as pencil |
| Export spritesheet | already covered in §13.4 | — |
| Shortcut help (`?`) | `test("? opens the shortcut cheat sheet")` | dialog role is visible, contains a known shortcut label |
| Reload persistence | `test("a sprite survives a reload", { retry: 0 })` | reload the browser tab via `page.reload()` from `@vitest/browser/context`, then re-query the canvas |

Each test is independent — a failure in "bucket fill" no longer prevents "reload persistence" from
running, and it reports as a normal Vitest failure with a stack trace and a diff, not a line in a
`failures` array. Once this file's coverage matches the table above:

- delete `scripts/smoke.mjs` and the `smoke` npm script;
- remove `puppeteer-core` from `devDependencies` — nothing else in the repo uses it.

## 13.6 Coverage gate

Once the matrix in §13.1 is filled, turn on a floor in `vitest.config.ts` so the next regression
is a red `test:coverage` run, not a missing test someone notices in review:

```ts
coverage: {
  provider: "v8",
  include: ["src/**/*.{ts,tsx}"],
  exclude: ["src/components/ui/**", "src/**/*.d.ts"],
  thresholds: { lines: 70, branches: 60 },
},
```

Start low and ratchet up in later phases — `src/components/ui/**` (generated shadcn primitives,
conventions.md §6b) is excluded because it's vendored, not authored, code. Do not chase 100%: a
coverage number that includes trivial getters and `PropTypes`-style plumbing rewards padding, not
confidence.

## 13.7 No CI exists yet

There is no `.github/workflows/` in this repo today. When one is added, its job needs one extra
setup step beyond `npm ci`:

```yaml
- run: npx playwright install --with-deps chromium
- run: npm run test:all
```

`--with-deps` installs the OS-level libraries Chromium needs on a bare Linux runner (fonts,
codecs) — omitting it is the most common way a browser-mode CI job passes locally and fails in
CI. This is a note for whoever adds CI, not a task this phase does itself.

---

## Done when

- [ ] Every row in the §13.1 matrix has at least one passing test in the project it names.
- [ ] `npm run test:browser` is green and takes under ~60s locally (parallelized across tabs by
      default — if it's slower, check for a test that isn't cleaning up its own IndexedDB state).
- [ ] `tests/browser/flows/core-editing.browser.test.tsx` covers everything
      `scripts/smoke.mjs` did; `scripts/smoke.mjs` and `puppeteer-core` are deleted.
- [ ] `npm run test:coverage` enforces the §13.6 thresholds and fails the build under them.
- [ ] No test file contains an explanatory comment beyond conventions.md §9's three cases — if a
      test needs a paragraph to justify itself, that paragraph belongs in this doc, not the file.
