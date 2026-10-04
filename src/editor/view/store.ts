import { create } from "zustand";
import { DEFAULT_CHECKER_SIZE, DEFAULT_TILE_SIZE, DEFAULT_ZOOM, ZOOM_LEVELS } from "@/constants/canvas";
import {
  constrainViewport,
  fitViewport,
  zoomAt,
  zoomStep,
  type Point,
  type Size,
  type Viewport,
} from "@/core/viewport";
import { clamp } from "@/lib/math";

export interface ViewState {
  viewport: Viewport;
  gridEnabled: boolean;
  gridSize: number;
  checkerSize: number;
  /** Last known container size, so zoom commands can constrain without a DOM read. */
  containerSize: Size;

  setViewport: (viewport: Viewport) => void;
  /** Also re-constrains the viewport, so a sprite that fits stays centred as the window resizes. */
  setContainerSize: (size: Size, sprite: Size) => void;
  panBy: (dx: number, dy: number, sprite: Size) => void;
  /** One ladder step, for the zoom commands. */
  zoom: (cursor: Point, direction: 1 | -1, sprite: Size) => void;
  /** Continuous zoom for wheel and pinch, kept within the ladder's ends. */
  zoomByFactor: (cursor: Point, factor: number, sprite: Size) => void;
  fitToContainer: (container: Size, sprite: Size) => void;
  toggleGrid: () => void;
  setGridEnabled: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  setCheckerSize: (size: number) => void;
  /** Grid and checkerboard to the sizes a sprite opens with (see `useGridReset`). */
  resetGrid: (gridSize: number, checkerSize: number) => void;
}

/** Before the first layout there is no container to constrain to; the fit on first layout does it. */
function constrainTo(container: Size, viewport: Viewport, sprite: Size): Viewport {
  return container.width ? constrainViewport(viewport, container, sprite) : viewport;
}

/**
 * Where the sprite sits on screen, and the grid and checkerboard drawn with it. Every viewport
 * change goes through `constrainViewport`: centred on an axis the sprite fits, scrollable only on one
 * it overflows.
 */
export const useViewStore = create<ViewState>()((set, get) => ({
  viewport: { scale: DEFAULT_ZOOM, originX: 0, originY: 0 },
  gridEnabled: true,
  gridSize: DEFAULT_TILE_SIZE,
  checkerSize: DEFAULT_CHECKER_SIZE,
  containerSize: { width: 0, height: 0 },

  setViewport: (viewport) => set({ viewport }),
  setContainerSize: (containerSize, sprite) =>
    set(({ viewport }) => ({ containerSize, viewport: constrainTo(containerSize, viewport, sprite) })),

  panBy: (dx, dy, sprite) => {
    const { viewport, containerSize } = get();
    const next = { ...viewport, originX: viewport.originX + dx, originY: viewport.originY + dy };
    set({ viewport: constrainTo(containerSize, next, sprite) });
  },

  zoom: (cursor, direction, sprite) => {
    const { viewport, containerSize } = get();
    set({ viewport: constrainTo(containerSize, zoomStep(viewport, cursor, direction), sprite) });
  },

  zoomByFactor: (cursor, factor, sprite) => {
    const { viewport, containerSize } = get();
    const scale = clamp(viewport.scale * factor, ZOOM_LEVELS[0], ZOOM_LEVELS[ZOOM_LEVELS.length - 1]);
    set({ viewport: constrainTo(containerSize, zoomAt(viewport, cursor, scale), sprite) });
  },

  fitToContainer: (container, sprite) =>
    set({
      containerSize: container,
      viewport: constrainViewport(fitViewport(container, sprite), container, sprite),
    }),

  toggleGrid: () => set(({ gridEnabled }) => ({ gridEnabled: !gridEnabled })),
  setGridEnabled: (gridEnabled) => set({ gridEnabled }),
  setGridSize: (gridSize) => set({ gridSize }),
  setCheckerSize: (checkerSize) => set({ checkerSize }),
  resetGrid: (gridSize, checkerSize) => set({ gridSize, checkerSize }),
}));
