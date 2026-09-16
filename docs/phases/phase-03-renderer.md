# Phase 3 — Canvas renderer & viewport

**Goal:** see the sprite. A stacked-canvas renderer with nearest-neighbour zoom, pan, pixel grid,
transparency checkerboard and a dirty-driven rAF loop — plus the editor store that holds view
state and the page decomposition the rest of the UI plugs into.

**Est.** 1.5 days · **Depends on:** phase 2

---

## 3.1 Compositor

`src/editor/composite.ts`

```ts
import { syncCelRaster } from '@/editor/cel';
import type { SpriteDocument } from '@/editor/document';

export interface CompositeOptions {
  /** Render a single layer only — used by the layer thumbnails. */
  onlyLayerId?: string;
  /** Ignore visibility flags — used by export ("export hidden layers" off by default). */
  includeHidden?: boolean;
}

/**
 * Draws one frame's visible layers into a sprite-resolution canvas.
 * Always sprite-resolution: scaling happens once, at present time, so cost is zoom-independent.
 */
export function compositeFrame(
  doc: SpriteDocument,
  frameId: string,
  target?: OffscreenCanvas,
  options: CompositeOptions = {},
): OffscreenCanvas {
  const canvas = ensureSize(target ?? new OffscreenCanvas(doc.width, doc.height), doc.width, doc.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const layer of doc.layers) {
    if (options.onlyLayerId && layer.id !== options.onlyLayerId) continue;
    if (!layer.visible && !options.includeHidden) continue;
    if (layer.opacity === 0) continue;

    const cel = doc.getCel(layer.id, frameId);
    if (!cel) continue;               // unpainted cel — nothing to draw

    syncCelRaster(cel);               // lazy putImageData, once per dirty cel per frame
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(cel.canvas, 0, 0);
  }

  ctx.globalAlpha = 1;
  return canvas;
}

function ensureSize(canvas: OffscreenCanvas, width: number, height: number): OffscreenCanvas {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return canvas;
}
```

## 3.2 Viewport math

Pure functions — no canvas, no DOM. This is where every off-by-one bug in a pixel editor lives,
so it gets its own unit tests.

`src/editor/viewport.ts`

```ts
import { clamp, stepLadder } from '@/lib/math';
import { ZOOM_LEVELS } from '@/constants/canvas';

export interface Viewport {
  /** Screen (CSS) pixels per sprite pixel. */
  scale: number;
  /** Top-left of the sprite in canvas CSS coordinates. */
  originX: number;
  originY: number;
}

export interface Size { width: number; height: number }
export interface Point { x: number; y: number }

/** Canvas-relative CSS point → integer sprite pixel. May be out of bounds; callers clamp. */
export function screenToSprite(viewport: Viewport, point: Point): Point {
  return {
    x: Math.floor((point.x - viewport.originX) / viewport.scale),
    y: Math.floor((point.y - viewport.originY) / viewport.scale),
  };
}

export function spriteToScreen(viewport: Viewport, point: Point): Point {
  return {
    x: point.x * viewport.scale + viewport.originX,
    y: point.y * viewport.scale + viewport.originY,
  };
}

export function isInsideSprite(point: Point, sprite: Size): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < sprite.width && point.y < sprite.height;
}

/** Zoom keeping the sprite pixel under the cursor fixed on screen. */
export function zoomAt(viewport: Viewport, cursor: Point, nextScale: number): Viewport {
  const ratio = nextScale / viewport.scale;
  return {
    scale: nextScale,
    originX: cursor.x - (cursor.x - viewport.originX) * ratio,
    originY: cursor.y - (cursor.y - viewport.originY) * ratio,
  };
}

export function zoomStep(viewport: Viewport, cursor: Point, direction: 1 | -1): Viewport {
  return zoomAt(viewport, cursor, stepLadder(viewport.scale, ZOOM_LEVELS, direction));
}

/** Largest ladder scale that fits, centred, with padding. */
export function fitViewport(container: Size, sprite: Size, padding = 24): Viewport {
  const available = {
    width: Math.max(1, container.width - padding * 2),
    height: Math.max(1, container.height - padding * 2),
  };
  const raw = Math.min(available.width / sprite.width, available.height / sprite.height);
  const scale = [...ZOOM_LEVELS].reverse().find((level) => level <= raw) ?? ZOOM_LEVELS[0];

  return {
    scale,
    originX: Math.round((container.width - sprite.width * scale) / 2),
    originY: Math.round((container.height - sprite.height * scale) / 2),
  };
}

/** Keeps at least a quarter of the sprite on screen so it can't be panned into the void. */
export function clampViewport(viewport: Viewport, container: Size, sprite: Size): Viewport {
  const margin = Math.min(sprite.width, sprite.height) * viewport.scale * 0.25;
  return {
    ...viewport,
    originX: clamp(viewport.originX, -sprite.width * viewport.scale + margin, container.width - margin),
    originY: clamp(viewport.originY, -sprite.height * viewport.scale + margin, container.height - margin),
  };
}
```

`src/editor/viewport.test.ts` — the cases that matter:

```ts
it('keeps the pixel under the cursor fixed while zooming', () => {
  const viewport = { scale: 4, originX: 10, originY: 10 };
  const cursor = { x: 50, y: 30 };
  const before = screenToSprite(viewport, cursor);
  const after = screenToSprite(zoomAt(viewport, cursor, 8), cursor);
  expect(after).toEqual(before);
});

it('maps the top-left screen pixel of a sprite pixel back to that pixel', () => {
  const viewport = { scale: 7, originX: 3, originY: 5 };
  expect(screenToSprite(viewport, spriteToScreen(viewport, { x: 4, y: 9 }))).toEqual({ x: 4, y: 9 });
});
```

## 3.3 The editor store (sliced)

One zustand store, composed from slices so each concern stays in its own file and each phase
adds to exactly one of them.

`src/stores/slices/types.ts`

```ts
import type { StateCreator } from 'zustand';
import type { ToolSlice } from '@/stores/slices/toolSlice';
import type { ViewSlice } from '@/stores/slices/viewSlice';
import type { ColorSlice } from '@/stores/slices/colorSlice';
import type { SelectionSlice } from '@/stores/slices/selectionSlice';

export type EditorStore = ToolSlice & ViewSlice & ColorSlice & SelectionSlice;
export type SliceCreator<T> = StateCreator<EditorStore, [], [], T>;
```

`src/stores/slices/viewSlice.ts`

```ts
import type { SliceCreator } from '@/stores/slices/types';
import type { Viewport } from '@/editor/viewport';
import { clampViewport, fitViewport, zoomStep, type Size } from '@/editor/viewport';
import { DEFAULT_ZOOM } from '@/constants/canvas';
import { ONION_DEFAULT } from '@/constants/animation';

export interface OnionConfig {
  enabled: boolean; before: number; after: number; opacity: number; tint: boolean;
}

export interface ViewSlice {
  viewport: Viewport;
  gridEnabled: boolean;
  onion: OnionConfig;
  activeFrameId: string | null;
  activeLayerId: string | null;

  setViewport: (viewport: Viewport) => void;
  panBy: (dx: number, dy: number) => void;
  zoom: (cursor: { x: number; y: number }, direction: 1 | -1) => void;
  fitToContainer: (container: Size, sprite: Size) => void;
  toggleGrid: () => void;
  setOnion: (patch: Partial<OnionConfig>) => void;
  setActiveFrame: (frameId: string) => void;
  setActiveLayer: (layerId: string) => void;
}

export const createViewSlice: SliceCreator<ViewSlice> = (set, get) => ({
  viewport: { scale: DEFAULT_ZOOM, originX: 0, originY: 0 },
  gridEnabled: true,
  onion: { ...ONION_DEFAULT },
  activeFrameId: null,
  activeLayerId: null,

  setViewport: (viewport) => set({ viewport }),
  panBy: (dx, dy) => set(({ viewport }) => ({
    viewport: { ...viewport, originX: viewport.originX + dx, originY: viewport.originY + dy },
  })),
  zoom: (cursor, direction) => set({ viewport: zoomStep(get().viewport, cursor, direction) }),
  fitToContainer: (container, sprite) =>
    set({ viewport: clampViewport(fitViewport(container, sprite), container, sprite) }),
  toggleGrid: () => set(({ gridEnabled }) => ({ gridEnabled: !gridEnabled })),
  setOnion: (patch) => set(({ onion }) => ({ onion: { ...onion, ...patch } })),
  setActiveFrame: (activeFrameId) => set({ activeFrameId }),
  setActiveLayer: (activeLayerId) => set({ activeLayerId }),
});
```

`src/stores/useEditorStore.ts`

```ts
import { create } from 'zustand';
import type { EditorStore } from '@/stores/slices/types';
import { createViewSlice } from '@/stores/slices/viewSlice';
import { createToolSlice } from '@/stores/slices/toolSlice';
import { createColorSlice } from '@/stores/slices/colorSlice';
import { createSelectionSlice } from '@/stores/slices/selectionSlice';

export const useEditorStore = create<EditorStore>()((...args) => ({
  ...createViewSlice(...args),
  ...createToolSlice(...args),
  ...createColorSlice(...args),
  ...createSelectionSlice(...args),
}));
```

Components subscribe with **narrow selectors** so a colour change doesn't re-render the frames
bar. Colocate the common ones in `src/stores/selectors.ts`:

```ts
export const selectViewport = (state: EditorStore) => state.viewport;
export const selectActiveIds = (state: EditorStore) =>
  ({ layerId: state.activeLayerId, frameId: state.activeFrameId });
```

> `selectActiveIds` returns a new object each call — pair it with `useShallow` from
> `zustand/react/shallow` at the call site, or destructure two separate selectors. Two selectors
> is the simpler default.

## 3.4 The renderer

`src/editor/renderer.ts` — owns the canvases and the rAF loop; knows nothing about React.

```ts
import { compositeFrame } from '@/editor/composite';
import type { SpriteDocument } from '@/editor/document';
import type { Viewport } from '@/editor/viewport';
import { CHECKER_TILE_PX, GRID_MIN_SCALE } from '@/constants/canvas';
import { ONION_TINT_AFTER, ONION_TINT_BEFORE } from '@/constants/animation';

export interface OnionConfig {
  enabled: boolean; before: number; after: number; opacity: number; tint: boolean;
}

export interface RendererTargets {
  main: HTMLCanvasElement;
  onion: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
}

export interface RendererState {
  viewport: Viewport;
  frameId: string;
  gridEnabled: boolean;
  onion: OnionConfig;
}

/** Tools install a painter to draw cursors, previews and selection ants. */
export type OverlayPainter = (ctx: CanvasRenderingContext2D, viewport: Viewport) => void;

type Channel = 'main' | 'onion' | 'overlay';

export class CanvasRenderer {
  private state: RendererState;
  private readonly dirty = new Set<Channel>(['main', 'onion', 'overlay']);
  private overlayPainter: OverlayPainter | null = null;
  private rafId = 0;
  private dpr = 1;
  private readonly composite = new OffscreenCanvas(1, 1);
  private readonly onionScratch = new OffscreenCanvas(1, 1);
  private readonly offDocument: () => void;

  constructor(
    private readonly doc: SpriteDocument,
    private readonly targets: RendererTargets,
    initialState: RendererState,
  ) {
    this.state = initialState;
    this.offDocument = doc.events.on('pixels', () => this.invalidate('main', 'onion'));
  }

  setState(patch: Partial<RendererState>): void {
    const previous = this.state;
    this.state = { ...previous, ...patch };

    if (patch.viewport && patch.viewport !== previous.viewport) this.invalidate('main', 'onion', 'overlay');
    if (patch.frameId && patch.frameId !== previous.frameId) this.invalidate('main', 'onion');
    if (patch.gridEnabled !== undefined) this.invalidate('overlay');
    if (patch.onion) this.invalidate('onion');
  }

  setOverlayPainter(painter: OverlayPainter | null): void {
    this.overlayPainter = painter;
    this.invalidate('overlay');
  }

  invalidate(...channels: Channel[]): void {
    for (const channel of channels) this.dirty.add(channel);
    this.schedule();
  }

  /** Call from a ResizeObserver. Sizes the backing store to device pixels. */
  resize(cssWidth: number, cssHeight: number, dpr = window.devicePixelRatio || 1): void {
    this.dpr = dpr;
    for (const canvas of Object.values(this.targets)) {
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }
    this.invalidate('main', 'onion', 'overlay');
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.offDocument();
  }

  private schedule(): void {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.render();
    });
  }

  private render(): void {
    if (this.dirty.has('onion')) this.renderOnion();
    if (this.dirty.has('main')) this.renderMain();
    if (this.dirty.has('overlay')) this.renderOverlay();
    this.dirty.clear();
  }

  private context(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);   // work in CSS pixels
    ctx.clearRect(0, 0, canvas.width / this.dpr, canvas.height / this.dpr);
    ctx.imageSmoothingEnabled = false;                   // nearest-neighbour upscaling
    return ctx;
  }

  private renderMain(): void {
    const ctx = this.context(this.targets.main);
    if (!ctx) return;
    const source = compositeFrame(this.doc, this.state.frameId, this.composite);
    this.present(ctx, source, 1);
  }

  private renderOnion(): void {
    const ctx = this.context(this.targets.onion);
    if (!ctx || !this.state.onion.enabled) return;

    const { before, after, opacity, tint } = this.state.onion;
    const index = this.doc.frameIndex(this.state.frameId);

    for (let offset = -before; offset <= after; offset++) {
      if (offset === 0) continue;
      const frame = this.doc.frames[index + offset];
      if (!frame) continue;

      // Nearer ghosts are more opaque.
      const distance = Math.abs(offset);
      const alpha = opacity / distance;
      const source = compositeFrame(this.doc, frame.id, this.onionScratch);
      this.present(ctx, tint ? tintCanvas(source, offset < 0 ? ONION_TINT_BEFORE : ONION_TINT_AFTER) : source, alpha);
    }
  }

  private renderOverlay(): void {
    const ctx = this.context(this.targets.overlay);
    if (!ctx) return;
    if (this.state.gridEnabled) this.drawGrid(ctx);
    this.overlayPainter?.(ctx, this.state.viewport);
  }

  private present(ctx: CanvasRenderingContext2D, source: OffscreenCanvas, alpha: number): void {
    const { scale, originX, originY } = this.state.viewport;
    ctx.globalAlpha = alpha;
    ctx.drawImage(source, originX, originY, this.doc.width * scale, this.doc.height * scale);
    ctx.globalAlpha = 1;
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const { scale, originX, originY } = this.state.viewport;
    if (scale < GRID_MIN_SCALE) return;                  // sub-pixel grid is just noise

    const width = this.doc.width * scale;
    const height = this.doc.height * scale;
    // Half-pixel offset keeps a 1px line on the pixel boundary instead of straddling it.
    const offset = 0.5 / this.dpr;

    ctx.lineWidth = 1 / this.dpr;
    ctx.strokeStyle = 'rgba(128,128,128,0.35)';
    ctx.beginPath();
    for (let x = 0; x <= this.doc.width; x++) {
      const screenX = Math.round(originX + x * scale) + offset;
      ctx.moveTo(screenX, originY);
      ctx.lineTo(screenX, originY + height);
    }
    for (let y = 0; y <= this.doc.height; y++) {
      const screenY = Math.round(originY + y * scale) + offset;
      ctx.moveTo(originX, screenY);
      ctx.lineTo(originX + width, screenY);
    }
    ctx.stroke();
  }
}

const tintScratch = new OffscreenCanvas(1, 1);

/** Flat-colours a composite while keeping its alpha — the cheap "ghost frame" look. */
function tintCanvas(source: OffscreenCanvas, color: string): OffscreenCanvas {
  tintScratch.width = source.width;
  tintScratch.height = source.height;
  const ctx = tintScratch.getContext('2d');
  if (!ctx) return source;

  ctx.clearRect(0, 0, source.width, source.height);
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, source.width, source.height);
  ctx.globalCompositeOperation = 'source-over';
  return tintScratch;
}
```

Note the checkerboard is **not** a canvas: it is a CSS layer positioned under the stack, which
keeps it out of the redraw path entirely.

```tsx
// src/components/editor/CheckerboardLayer.tsx
import { CHECKER_TILE_PX } from '@/constants/canvas';
import type { Viewport } from '@/editor/viewport';

export function CheckerboardLayer({ viewport, width, height }: {
  viewport: Viewport; width: number; height: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: viewport.originX,
        top: viewport.originY,
        width: width * viewport.scale,
        height: height * viewport.scale,
        backgroundImage:
          'conic-gradient(var(--checker-a) 25%, var(--checker-b) 0 50%, var(--checker-a) 0 75%, var(--checker-b) 0)',
        backgroundSize: `${CHECKER_TILE_PX * 2}px ${CHECKER_TILE_PX * 2}px`,
      }}
    />
  );
}
```

with `--checker-a/--checker-b` defined per theme in `index.css`.

## 3.5 Wiring it to React

One component owns the canvas refs — nothing else in the app touches a canvas element.

`src/hooks/useCanvasRenderer.ts`

```ts
import { useEffect, useRef, useState } from 'react';
import { CanvasRenderer, type RendererTargets } from '@/editor/renderer';
import { useEditorStore } from '@/stores/useEditorStore';
import type { SpriteDocument } from '@/editor/document';

export function useCanvasRenderer(doc: SpriteDocument) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLCanvasElement>(null);
  const onionRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [renderer, setRenderer] = useState<CanvasRenderer | null>(null);

  const viewport = useEditorStore((state) => state.viewport);
  const gridEnabled = useEditorStore((state) => state.gridEnabled);
  const onion = useEditorStore((state) => state.onion);
  const frameId = useEditorStore((state) => state.activeFrameId);
  const fitToContainer = useEditorStore((state) => state.fitToContainer);

  // Create once per document.
  useEffect(() => {
    const targets: RendererTargets | null =
      mainRef.current && onionRef.current && overlayRef.current
        ? { main: mainRef.current, onion: onionRef.current, overlay: overlayRef.current }
        : null;
    if (!targets) return;

    const instance = new CanvasRenderer(doc, targets, {
      viewport: useEditorStore.getState().viewport,
      frameId: frameId ?? doc.frames[0].id,
      gridEnabled,
      onion,
    });
    setRenderer(instance);
    return () => { instance.dispose(); setRenderer(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild only when the document changes
  }, [doc]);

  // Size to the container and fit on first layout.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !renderer) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      renderer.resize(width, height);
      fitToContainer({ width, height }, { width: doc.width, height: doc.height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [renderer, doc, fitToContainer]);

  // Push store state into the imperative renderer.
  useEffect(() => {
    renderer?.setState({ viewport, gridEnabled, onion, frameId: frameId ?? doc.frames[0].id });
  }, [renderer, viewport, gridEnabled, onion, frameId, doc]);

  return { containerRef, mainRef, onionRef, overlayRef, renderer };
}
```

`src/components/editor/EditorCanvas.tsx`

```tsx
import { CheckerboardLayer } from '@/components/editor/CheckerboardLayer';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';
import { useCanvasViewControls } from '@/hooks/useCanvasViewControls';
import { usePointerPaint } from '@/hooks/usePointerPaint';   // phase 4
import { useDocumentSession } from '@/app/DocumentProvider';
import { useEditorStore } from '@/stores/useEditorStore';

export function EditorCanvas() {
  const { doc } = useDocumentSession();
  const { containerRef, mainRef, onionRef, overlayRef, renderer } = useCanvasRenderer(doc);
  const viewport = useEditorStore((state) => state.viewport);

  useCanvasViewControls(containerRef);         // wheel zoom, space/middle pan
  usePointerPaint(containerRef, renderer);     // phase 4 — tools

  return (
    <div
      ref={containerRef}
      className="relative size-full overflow-hidden bg-[--canvas-bg] touch-none"
    >
      <CheckerboardLayer viewport={viewport} width={doc.width} height={doc.height} />
      <canvas ref={onionRef} className="pointer-events-none absolute inset-0" />
      <canvas ref={mainRef} className="pointer-events-none absolute inset-0" />
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0" />
    </div>
  );
}
```

All three canvases are `pointer-events-none`: pointer handling lives on the container, so hit
testing is one element and one coordinate transform.

`src/hooks/useCanvasViewControls.ts`

```ts
import { useEffect, useRef, type RefObject } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';

export function useCanvasViewControls(containerRef: RefObject<HTMLElement | null>) {
  const spacePressed = useRef(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey && Math.abs(event.deltaY) < 2) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      useEditorStore.getState().zoom(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        event.deltaY < 0 ? 1 : -1,
      );
    };

    // passive:false — the browser's page zoom must be prevented over the canvas.
    element.addEventListener('wheel', onWheel, { passive: false });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') spacePressed.current = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spacePressed.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let panning = false;
    let last = { x: 0, y: 0 };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 1 && !spacePressed.current) return;
      panning = true;
      last = { x: event.clientX, y: event.clientY };
      element.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!panning) return;
      useEditorStore.getState().panBy(event.clientX - last.x, event.clientY - last.y);
      last = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = () => { panning = false; };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);

    return () => {
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [containerRef]);
}
```

## 3.6 Editor page layout

Decomposed from the start — see [conventions.md §2](../conventions.md). `EditorPage` does routing
and layout only; it holds no editor logic.

```tsx
// src/components/editor/EditorPage.tsx
import { useParams } from 'react-router';
import { DocumentProvider } from '@/app/DocumentProvider';
import { EditorCanvas } from '@/components/editor/EditorCanvas';
import { EditorTopBar } from '@/components/editor/EditorTopBar';
import { ToolSidebar } from '@/components/editor/ToolSidebar';
import { RightSidebar } from '@/components/editor/RightSidebar';
import { FramesBar } from '@/components/editor/FramesBar';
import { EditorStatusBar } from '@/components/editor/EditorStatusBar';

export function EditorPage() {
  const { spriteId } = useParams<{ spriteId: string }>();
  if (!spriteId) return null;

  return (
    <DocumentProvider spriteId={spriteId}>
      <div className="grid h-dvh grid-rows-[3rem_1fr_auto_1.75rem] bg-background text-foreground">
        <EditorTopBar />
        <div className="grid min-h-0 grid-cols-[3.25rem_1fr_17rem]">
          <ToolSidebar />
          <EditorCanvas />
          <RightSidebar />   {/* palette · layers · preview, phases 6–8 */}
        </div>
        <FramesBar />
        <EditorStatusBar />
      </div>
    </DocumentProvider>
  );
}
```

Each panel is its own file and subscribes to exactly the store slice it needs. The grid template
is the whole layout — no nested flex chains, no `calc()` heights.

---

## Done when

- [ ] Opening `/sprites/:id` renders the sprite centred and fit to the viewport.
- [ ] Wheel zooms around the cursor; the pixel under the cursor does not drift (test + by eye).
- [ ] Space-drag and middle-drag pan; the sprite cannot be panned fully off-screen.
- [ ] Grid appears above 6× zoom, disappears below, toggles from the store.
- [ ] Zooming to 32× shows hard pixel edges, no blurring, and crisp 1px grid lines on retina.
- [ ] Nothing re-renders React on a `pixels` event (verify with React DevTools' highlight updates
      once phase 4 lands drawing).
