# Phase 12 — Test infrastructure: browser mode & a dedicated test tree

**Goal:** stop colocating tests next to implementation, split Vitest into two projects — `unit`
(jsdom, pure logic) and `browser` (real Chromium via the Playwright provider) — and give every
future test a real DOM, a real canvas, and real pointer/keyboard input to run against. No new
test *cases* yet; phase 13 spends this infrastructure.

**Est.** 1 day · **Depends on:** all previous phases (it touches every existing test file)

---

## 12.1 Why coverage stopped at the editor core

`npm run test` is green with 128 tests, but grep tells the real story:

```
$ grep -rl "describe(" src --include="*.test.ts" | sed 's#/[^/]*$##' | sort -u
src/db
src/db/repositories
src/editor
src/editor/commands
src/editor/tools
src/export
src/lib
src/services
```

Every test file sits under a folder that is framework-free or DB-only — exactly the layer that
`no-restricted-imports` (conventions.md §10) already forces to be pure. Zero test files exist
under `src/components/`, `src/hooks/`, or `src/stores/`: the layer that owns the canvas, the tool
sidebar, dialogs, and every keyboard shortcut has no coverage at all, and neither does the
interaction between them (draw a stroke → history updates → status bar reflects it).

That's not an oversight so much as a tooling gap. `src/test/setup.ts` stubs `OffscreenCanvas`
with a no-op class (phase 0, §0.1) precisely because jsdom cannot run one — which means jsdom was
never going to be able to verify that a pencil stroke actually paints a pixel. The only place
that ever exercised a real canvas was `scripts/smoke.mjs`, and that script:

- is not part of `npm run test` — nothing stops a broken build from being pushed with green CI;
- hardcodes `/Applications/Google Chrome.app/…`, so it only ever runs on the author's Mac;
- needs the dev server started by hand in a second terminal first;
- has no test isolation or framework: one failed `await` mid-script aborts everything after it,
  and a failure surfaces as a diffed screenshot in `.smoke/`, not an assertion with a stack trace.

Phases 12–13 close that gap: move every test into one tree, add a second Vitest project that runs
against a real browser, and replace `scripts/smoke.mjs` with assertions that run the same way
`npm run test` does.

## 12.2 Decision: Vitest Browser Mode (Playwright provider), not jsdom + Testing Library

| | jsdom + Testing Library | Vitest Browser Mode |
| --- | --- | --- |
| Canvas / `OffscreenCanvas` | stubbed no-ops | real, same as production |
| Pointer capture, drag sequences | simulated events, approximate | real Chromium input pipeline |
| Layout, `getBoundingClientRect`, zoom math | fabricated by jsdom, often wrong | real layout engine |
| Keyboard shortcuts, focus, `aria-*` | works fine | works fine |
| Speed | fast | slower per test, parallelizes across tabs |
| Runner / config surface | one (Vitest) | one (Vitest) — no separate Playwright Test runner/reporter |

`EditorCanvas` (phase 3) composites layers through `OffscreenCanvas`, and every drawing tool
(phase 4) reasons in device pixels derived from real `getBoundingClientRect()` zoom math. A test
that stubs both isn't testing the renderer, it's testing the stub. Vitest's browser mode runs the
component tree in an actual Chromium tab over the Playwright CDP connection, using the same
`describe`/`it`/`expect`/`vi` API as today — one runner, one config file, one `npm run test`
mental model. The choice of environment becomes a per-file detail (`.browser.test.tsx` vs
`.test.ts`), not a second toolchain.

Full Playwright Test (`@playwright/test`) is deliberately not adopted: it would mean two runners,
two configs, two reporters, and no shared code between a "does `floodFill` respect tolerance"
unit test and a "does clicking bucket fill the canvas" interaction test. Vitest's own browser mode
was built for exactly this overlap.

Testing Library's queries (`getByRole`, `getByLabelText`) stay — they're environment-agnostic and
already the right way to find elements by accessible role rather than test id. What changes is
where they run: `@testing-library/react`'s `render()` assumes jsdom internals a real browser tab
doesn't expose, so component mounting goes through `vitest-browser-react`, the Vitest team's
browser-mode equivalent, which returns the same query surface backed by Vitest's own locators.

## 12.3 The test tree

All tests move out of `src/` into a tree that mirrors it one level down, split by project:

```
tests/
  unit/                        # project: unit — jsdom, no DOM assertions, no canvas
    db/
      backup.test.ts
      seed.test.ts
      repositories/
        cels.test.ts
        sprites.test.ts
    editor/
      buffer.test.ts
      document.test.ts
      history.test.ts
      pixels.test.ts
      selection.test.ts
      viewport.test.ts
      commands/
        frames.test.ts
        layers.test.ts
      tools/
        tools.test.ts
    export/
      spritesheetLayout.test.ts
    lib/
      color.test.ts
      math.test.ts
      rect.test.ts
    services/
      documentService.test.ts
  browser/                      # project: browser — real Chromium, Playwright provider
    components/
    hooks/
    interactions/
    flows/
  support/
    setup.unit.ts                # was src/test/setup.ts
    setup.browser.ts
    factories.ts                 # was src/test/factories.ts
    render.tsx
```

`tests/unit/**` is a straight `git mv` of the existing 18 files — same content, same assertions,
only the path changes. `tests/browser/**` is new; this phase only proves the project boots
(§12.6), and phase 13 fills it in.

Import the shared alias `@test/*` instead of relative `../../` chains climbing out of `tests/`:

```ts
// tests/unit/editor/history.test.ts
import { setPixel } from "@/editor/buffer";
import { History, StrokeRecorder, type Command } from "@/editor/history";
import { makeDocument, RED } from "@test/factories";
```

## 12.4 Dependencies

```bash
npm i -D @vitest/browser playwright vitest-browser-react @vitest/coverage-v8
npx playwright install chromium
```

| Package | Why this one |
| --- | --- |
| `@vitest/browser` | The Vitest-native browser runner: same config file, same reporter, same watch mode as the jsdom project. |
| `playwright` | The driver `@vitest/browser` launches Chromium through. Not `@playwright/test` — that's a separate runner this setup deliberately avoids (§12.2). |
| `vitest-browser-react` | Renders React components inside the browser-mode DOM and returns Testing-Library-style queries; `@testing-library/react`'s own `render()` doesn't work against a real browser context. |
| `@vitest/coverage-v8` | `--coverage` errors today with "no coverage provider" — needed once phase 13 adds a coverage gate. |

`playwright install chromium` downloads a browser binary outside npm's dependency graph (it lands
in `~/.cache/ms-playwright` or the CI equivalent) and won't appear in `package-lock.json`. Add it
to `docs/README.md` as a required one-time setup step next to `npm install` — a fresh clone
otherwise fails the browser project with an opaque "executable doesn't exist" error rather than a
useful one.

## 12.5 Vitest projects

One config file, two projects — `test.projects` is the current, non-deprecated way to do this
(the standalone `vitest.workspace.ts` file is the older, now-legacy pattern):

`vitest.config.ts`

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const alias = {
  "@": path.resolve(__dirname, "./src"),
  "@test": path.resolve(__dirname, "./tests/support"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/components/ui/**", "src/**/*.d.ts"],
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./tests/support/setup.unit.ts"],
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "browser",
          globals: true,
          setupFiles: ["./tests/support/setup.browser.ts"],
          include: ["tests/browser/**/*.browser.test.tsx"],
          browser: {
            enabled: true,
            provider: "playwright",
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
```

The `.browser.test.tsx` suffix (instead of the shared `.test.ts`) is load-bearing, not stylistic:
it lets `include` patterns route each file to the right project without a directory-only split,
and it makes the environment a file-name fact visible in a plain directory listing.

`package.json` scripts:

```json
"scripts": {
  "test": "vitest run --project=unit",
  "test:browser": "vitest run --project=browser",
  "test:all": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "smoke": "node scripts/smoke.mjs .smoke"
}
```

`npm test` stays fast (jsdom only) for the inner dev loop; `test:all` is what a CI job runs.
`scripts/smoke.mjs` is left as-is for this phase — phase 13 retires it once `tests/browser/flows/`
covers the same ground with real assertions instead of a screenshot diff.

## 12.6 Support files

`tests/support/setup.unit.ts` — unchanged content, moved from `src/test/setup.ts` (the
`OffscreenCanvas` stub and `fake-indexeddb/auto` import, per phase 0 §0.1).

`tests/support/setup.browser.ts` — a real browser has real `OffscreenCanvas` and real
`IndexedDB`, so this file only clears state between tests, since a browser-mode tab persists
storage across the whole run rather than resetting per file the way jsdom does:

```ts
import { afterEach } from "vitest";
import { DB_NAME } from "@/constants/storage";

afterEach(async () => {
  indexedDB.deleteDatabase(DB_NAME);
});
```

`tests/support/render.tsx` — every browser test mounts through this, not through
`vitest-browser-react` directly, so app providers (router, theme) are never repeated per file:

```tsx
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { render as renderBrowser } from "vitest-browser-react";
import { AppProviders } from "@/app/providers";

export function render(ui: ReactNode, { route = "/" } = {}) {
  return renderBrowser(
    <MemoryRouter initialEntries={[route]}>
      <AppProviders>{ui}</AppProviders>
    </MemoryRouter>,
  );
}

export { userEvent } from "@vitest/browser/context";
```

`tests/support/factories.ts` — moved from `src/test/factories.ts`, content unchanged (phase 2).

One smoke spec proves the wiring before phase 13 builds on it:

`tests/browser/components/smoke.browser.test.tsx`

```tsx
import { expect, test } from "vitest";
import { render } from "@test/render";

test("renders a button in a real browser DOM", async () => {
  const screen = render(<button>Hello</button>);
  await expect.element(screen.getByRole("button", { name: "Hello" })).toBeVisible();
});
```

## 12.7 Update the conventions

`conventions.md` gets a new §11 (see that file) recording the rule this phase exists to enforce:
tests live in `tests/`, never beside the file they cover, and a test file holds assertions and
fixtures only — no prose. Explaining *why* a behavior is tested belongs in the phase doc that
introduced it, not in a comment block above the `it(...)`.

---

## Done when

- [ ] `src/` contains zero `*.test.*` or `*.spec.*` files; `find src -iname '*.test.*'` is empty.
- [ ] `tests/unit/**` holds all 18 pre-existing test files; `npm run test` is green with the same
      128 passing tests, unchanged in behaviour.
- [ ] `npm run test:browser` boots headless Chromium and passes the one smoke spec.
- [ ] `npx playwright install chromium` is documented as a required setup step in
      `docs/README.md`.
- [ ] `npm run test:all` runs both projects and both are green.
- [ ] `npm run test:coverage` produces a report (no threshold enforced yet — phase 13).
- [ ] `conventions.md` documents the `tests/` rule so phase 13, and everything after it, follows
      it without re-litigating.
