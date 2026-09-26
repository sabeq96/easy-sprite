import { DEFAULT_CHECKER_SIZE, DEFAULT_TILE_SIZE, DEFAULT_ZOOM } from "@/constants/canvas";
import { ONION_DEFAULT, type OnionDirection } from "@/constants/animation";
import { clampViewport, fitViewport, zoomStep, type Point, type Size, type Viewport } from "@/editor/viewport";
import type { SliceCreator } from "@/stores/slices/types";

export interface OnionConfig {
  enabled: boolean;
  direction: OnionDirection;
  opacity: number;
}

export interface ViewSlice {
  viewport: Viewport;
  gridEnabled: boolean;
  gridSize: number;
  checkerSize: number;
  onion: OnionConfig;
  /** Last known container size, so zoom commands can clamp without a DOM read. */
  containerSize: Size;
  activeFrameId: string | null;
  activeLayerId: string | null;
  /** Mirrors the preview player so the renderer can skip onion skin during playback. */
  isPlaying: boolean;

  setViewport: (viewport: Viewport) => void;
  setContainerSize: (size: Size) => void;
  panBy: (dx: number, dy: number, sprite: Size) => void;
  zoom: (cursor: Point, direction: 1 | -1, sprite: Size) => void;
  fitToContainer: (container: Size, sprite: Size) => void;
  toggleGrid: () => void;
  setGridEnabled: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  setCheckerSize: (size: number) => void;
  /** Grid to `gridSize` (a sprite's tile), chessboard to its default — done whenever a sprite opens. */
  resetGrid: (gridSize: number) => void;
  setOnion: (patch: Partial<OnionConfig>) => void;
  setActiveFrame: (frameId: string) => void;
  setActiveLayer: (layerId: string) => void;
  setPlaying: (isPlaying: boolean) => void;
}

export const createViewSlice: SliceCreator<ViewSlice> = (set, get) => ({
  viewport: { scale: DEFAULT_ZOOM, originX: 0, originY: 0 },
  gridEnabled: true,
  gridSize: DEFAULT_TILE_SIZE,
  checkerSize: DEFAULT_CHECKER_SIZE,
  onion: { ...ONION_DEFAULT },
  containerSize: { width: 0, height: 0 },
  activeFrameId: null,
  activeLayerId: null,
  isPlaying: false,

  setViewport: (viewport) => set({ viewport }),
  setContainerSize: (containerSize) => set({ containerSize }),

  // Clamped like zoom, so a long drag can never push the sprite entirely off screen.
  panBy: (dx, dy, sprite) => {
    const { viewport, containerSize } = get();
    const next = { ...viewport, originX: viewport.originX + dx, originY: viewport.originY + dy };
    set({ viewport: containerSize.width ? clampViewport(next, containerSize, sprite) : next });
  },

  zoom: (cursor, direction, sprite) => {
    const { viewport, containerSize } = get();
    const next = zoomStep(viewport, cursor, direction);
    set({
      viewport: containerSize.width ? clampViewport(next, containerSize, sprite) : next,
    });
  },

  fitToContainer: (container, sprite) =>
    set({
      containerSize: container,
      viewport: clampViewport(fitViewport(container, sprite), container, sprite),
    }),

  toggleGrid: () => set(({ gridEnabled }) => ({ gridEnabled: !gridEnabled })),
  setGridEnabled: (gridEnabled) => set({ gridEnabled }),
  setGridSize: (gridSize) => set({ gridSize }),
  setCheckerSize: (checkerSize) => set({ checkerSize }),
  resetGrid: (gridSize) => set({ gridSize, checkerSize: DEFAULT_CHECKER_SIZE }),
  setOnion: (patch) => set(({ onion }) => ({ onion: { ...onion, ...patch } })),
  setActiveFrame: (activeFrameId) => set({ activeFrameId }),
  setActiveLayer: (activeLayerId) => set({ activeLayerId }),
  setPlaying: (isPlaying) => set({ isPlaying }),
});
