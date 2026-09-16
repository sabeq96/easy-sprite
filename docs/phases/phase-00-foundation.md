# Phase 0 — Foundation & app shell

**Goal:** the skeleton every later phase drops into — dependencies, folder structure, enforced
module boundaries, constants, shared utils, routing, and a dark-mode app shell. No sprite logic yet.

**Est.** 0.5 day · **Depends on:** nothing

---

## 0.1 Dependencies

The scaffold has three packages that are install-time accidents and should go:

```bash
npm remove init npx
```

Two packages that look like accidents but are not, and must stay:

- **`cn`** — the base-nova shadcn style generates `import { cn } from "cn"`, as in
  `src/components/ui/button.tsx`.
- **`shadcn`** — `src/index.css` does `@import "shadcn/tailwind.css"`, which is the style layer
  the generated components are built against. Removing it fails the production build with
  `Can't resolve 'shadcn/tailwind.css'`. The CLI is still used as `npx shadcn@latest add …`.

Add what the app actually needs:

```bash
npm i dexie@^4.4.6 dexie-react-hooks@^4.4.0 zustand@^5.0.15
npm i -D vitest@^3 @vitest/ui jsdom fake-indexeddb
```

| Package | Why this one |
| --- | --- |
| `dexie` | Best-in-class TS story for IndexedDB: `EntityTable<T, 'id'>` gives fully typed collections, typed compound indexes, transactions, and schema versioning/upgrades. `idb` is thinner but you hand-roll every query; `RxDB` is an order of magnitude more machinery than a local-only app needs. |
| `dexie-react-hooks` | `useLiveQuery()` — the sprite gallery re-renders on DB writes with zero manual invalidation. |
| `zustand` | 1 KB, no provider, selector-based subscriptions so tool changes don't re-render the canvas tree. Context + `useReducer` would re-render the whole editor on every colour change. |
| `fake-indexeddb` | Lets repository tests run in Vitest/node. |

Add test scripts to `package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "oxlint",
  "test": "vitest run",
  "test:watch": "vitest",
  "preview": "vite preview"
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], globals: true },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
```

`src/test/setup.ts`:

```ts
import 'fake-indexeddb/auto';

// jsdom has no OffscreenCanvas; the editor core only needs it for raster caching,
// which no unit test asserts on. Stub just enough for constructors to succeed.
if (!('OffscreenCanvas' in globalThis)) {
  class OffscreenCanvasStub {
    constructor(public width: number, public height: number) {}
    getContext() {
      return { putImageData() {}, drawImage() {}, clearRect() {}, getImageData: () => null };
    }
  }
  Object.assign(globalThis, { OffscreenCanvas: OffscreenCanvasStub });
}
```

## 0.2 Folder scaffold

```bash
mkdir -p src/{app,components/{editor,manager,common},editor/tools,db/repositories,export,hooks,stores,lib,constants,types,test}
```

Empty folders are fine — each phase fills its own. The shape is the contract; see
[conventions.md §1](../conventions.md) for what belongs where.

## 0.3 Enforce the module boundaries

Replace `.oxlintrc.json` with the config in [conventions.md §10](../conventions.md). The rule that
matters is `no-restricted-imports` scoped to `src/editor/**`: the core must stay React-free and
DB-free. Verify it works before moving on — the rule silently not firing is worse than no rule:

```bash
echo "import { useState } from 'react';" > src/editor/__boundary-check.ts
npm run lint          # must report an error for that file
rm src/editor/__boundary-check.ts
```

## 0.4 Constants

`src/constants/canvas.ts`

```ts
export const ZOOM_LEVELS = [0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32] as const;
export const DEFAULT_ZOOM = 8;
export const MIN_CANVAS_SIZE = 1;
export const MAX_CANVAS_SIZE = 512;
export const DEFAULT_CANVAS_SIZE = 32;
export const CANVAS_SIZE_PRESETS = [8, 16, 32, 48, 64, 96, 128] as const;

/** Below this zoom the pixel grid is noise, so it is hidden regardless of the toggle. */
export const GRID_MIN_SCALE = 6;
export const CHECKER_TILE_PX = 8;

/** Warn the user above this many bytes of pixel data in one sprite (~48 MB). */
export const SPRITE_SIZE_WARN_BYTES = 48 * 1024 * 1024;
```

`src/constants/animation.ts`

```ts
export const DEFAULT_FPS = 12;
export const MIN_FPS = 1;
export const MAX_FPS = 60;
export const ONION_MAX_FRAMES = 3;
export const ONION_DEFAULT = { enabled: false, before: 1, after: 1, opacity: 0.35, tint: true } as const;
export const ONION_TINT_BEFORE = '#ff4d4d';
export const ONION_TINT_AFTER = '#4d9dff';
```

`src/constants/tools.ts`

```ts
export const TOOL_IDS = [
  'pencil', 'mirrorPencil', 'eraser', 'bucket', 'fillSimilar', 'picker', 'select', 'move',
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export const BRUSH_SIZES = [1, 2, 3, 4, 6, 8] as const;
export const DEFAULT_BRUSH_SIZE = 1;
export const DEFAULT_FILL_TOLERANCE = 0;
export const MAX_FILL_TOLERANCE = 255;
```

`src/constants/storage.ts` and `src/constants/export.ts` — as listed in
[conventions.md §4](../conventions.md), plus:

```ts
// src/constants/export.ts
export const SPRITESHEET_LAYOUTS = ['horizontal', 'vertical', 'grid'] as const;
export type SpritesheetLayout = (typeof SPRITESHEET_LAYOUTS)[number];
export const EXPORT_SCALES = [1, 2, 4, 8, 16] as const;
export const DEFAULT_EXPORT_SCALE = 1;
```

## 0.5 Shared utils

`src/lib/id.ts`

```ts
/** Stable, collision-free ids so JSON backups re-import without remapping foreign keys. */
export function createId(): string {
  return crypto.randomUUID();
}
```

`src/lib/color.ts`

```ts
export interface RGBA { r: number; g: number; b: number; a: number } // all 0–255

export const TRANSPARENT: RGBA = { r: 0, g: 0, b: 0, a: 0 };

export function hexToRgba(hex: string): RGBA {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: full.length === 8 ? parseInt(full.slice(6, 8), 16) : 255,
  };
}

export function rgbaToHex({ r, g, b, a }: RGBA, includeAlpha = false): string {
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}${includeAlpha ? hex(a) : ''}`;
}

/** Packed 0xRRGGBBAA — cheap key for palette lookups and colour-count maps. */
export function packRgba({ r, g, b, a }: RGBA): number {
  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}

export function rgbaEquals(a: RGBA, b: RGBA): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

/** Perceptual-ish luminance, used to choose readable text over a swatch. */
export function luminance({ r, g, b }: RGBA): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
```

`src/lib/rect.ts`

```ts
export interface Rect { x: number; y: number; w: number; h: number }

export const EMPTY_RECT: Rect = { x: 0, y: 0, w: 0, h: 0 };

export function rectFromPoints(x0: number, y0: number, x1: number, y1: number): Rect {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return { x, y, w: Math.abs(x1 - x0) + 1, h: Math.abs(y1 - y0) + 1 };
}

export function rectUnion(a: Rect | null, b: Rect): Rect {
  if (!a || a.w === 0) return b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

export function rectClamp(r: Rect, w: number, h: number): Rect {
  const x = Math.max(0, Math.min(r.x, w));
  const y = Math.max(0, Math.min(r.y, h));
  return { x, y, w: Math.min(r.w + r.x - x, w - x), h: Math.min(r.h + r.y - y, h - y) };
}

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}
```

`src/lib/math.ts`

```ts
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Snap to the nearest entry of an ascending ladder (zoom levels, fps presets). */
export function snapToLadder(value: number, ladder: readonly number[]): number {
  return ladder.reduce((best, n) => (Math.abs(n - value) < Math.abs(best - value) ? n : best), ladder[0]);
}

export function stepLadder(value: number, ladder: readonly number[], direction: 1 | -1): number {
  const index = ladder.indexOf(snapToLadder(value, ladder));
  return ladder[clamp(index + direction, 0, ladder.length - 1)];
}
```

`src/lib/utils.ts` — components.json points the `utils` alias here, so re-export `cn` for app code
while generated shadcn components keep importing the package directly:

```ts
export { cn } from 'cn';
```

## 0.6 Routing

Declarative, as requested. `src/app/routes.tsx`:

```tsx
import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from '@/app/AppLayout';
import { SpriteManagerPage } from '@/components/manager/SpriteManagerPage';
import { EditorPage } from '@/components/editor/EditorPage';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { NotFoundPage } from '@/components/common/NotFoundPage';

export const ROUTES = {
  sprites: '/sprites',
  sprite: (id: string) => `/sprites/${id}`,
  settings: '/settings',
} as const;

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to={ROUTES.sprites} replace />} />
        <Route path="sprites" element={<SpriteManagerPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      {/* The editor is full-bleed: it deliberately sits outside the padded shell. */}
      <Route path="sprites/:spriteId" element={<EditorPage />} />
    </Routes>
  );
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppRoutes } from '@/app/routes';
import { AppProviders } from '@/app/providers';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
```

Delete `src/App.tsx` (it is the Vite counter demo and currently doesn't even compile — it uses
`Button` without importing it).

## 0.7 App shell

`src/app/AppLayout.tsx`

```tsx
import { NavLink, Outlet } from 'react-router';
import { Images, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/app/routes';

const NAV = [
  { to: ROUTES.sprites, label: 'Sprites', icon: Images },
  { to: ROUTES.settings, label: 'Settings', icon: Settings },
];

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
        <span className="mr-4 text-sm font-semibold tracking-tight">Sprite Editor</span>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                isActive && 'bg-muted text-foreground',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
```

`src/hooks/useTheme.ts` — dark by default; a pixel editor is used in the dark and the canvas
reads better against a neutral surface.

```ts
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'sprite-editor:theme';
export type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'dark',
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return { theme, setTheme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
}
```

`src/app/providers.tsx` stays deliberately thin for now — phase 2 adds the document provider and
phase 11 the shortcut scope:

```tsx
import type { ReactNode } from 'react';

export function AppProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

## 0.8 Placeholder pages

Three stubs so routing is verifiable today: `SpriteManagerPage`, `EditorPage`, `SettingsPage`,
`NotFoundPage` — each a heading plus a `<Link>` back. They get replaced in phases 9, 3 and 9.

## 0.9 shadcn components to pull now

```bash
npx shadcn@latest add button input label field card badge dialog alert-dialog \
  dropdown-menu context-menu menubar tooltip kbd separator slider switch tabs \
  popover scroll-area toggle toggle-group select sonner skeleton empty
```

These cover phases 0–10. Pull `command` in phase 11 for the command palette.

**This list is the UI vocabulary for the whole app.** Per
[conventions.md §6b](../conventions.md), panels are composed from these primitives with
layout-only utility classes; if something needs a primitive that is not here, install it rather
than hand-rolling it.

---

## Done when

- [ ] `npm run dev` serves `/` and redirects to `/sprites`; all four routes render.
- [ ] `npm run build` passes with no TS errors (`tsc -b` is part of build).
- [ ] `npm run lint` errors on a React import inside `src/editor/` and passes otherwise.
- [ ] `npm run test` runs (zero tests is fine) with `fake-indexeddb` loaded.
- [ ] Theme toggle persists across reload; dark is the default.
- [ ] `src/App.tsx` is gone; `init` and `npx` are out of `dependencies` (`cn` and `shadcn` stay).
