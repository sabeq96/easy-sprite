import { create } from "zustand";
import {
  BUILDER_ZOOM_LEVELS,
  DEFAULT_BUILDER_GRID_CELL,
  DEFAULT_BUILDER_ZOOM,
} from "@/constants/builder";
import type { Size } from "@/editor/viewport";
import { stepLadder } from "@/lib/math";

export interface BuilderViewState {
  zoom: number;
  gridEnabled: boolean;
  gridCell: number;
  /** Last known size of the scrolling sheet panel, so `fit` needs no DOM read at click time. */
  containerSize: Size;

  zoomBy: (direction: 1 | -1) => void;
  /** Largest ladder step at which `sheet` (in sprite px) still fits the panel. */
  fit: (sheet: Size) => void;
  toggleGrid: () => void;
  setGridCell: (cell: number) => void;
  setContainerSize: (size: Size) => void;
}

/**
 * The composer's view state. Separate from useEditorStore on purpose: that store's viewport carries
 * a pan origin and clamps tied to one sprite's dimensions, and the composer has no document at all.
 * Session-only, like the pixel editor's own zoom.
 */
export const useBuilderViewStore = create<BuilderViewState>()((set) => ({
  zoom: DEFAULT_BUILDER_ZOOM,
  // On by default: the grid is how you see at a glance that sprites sit flush.
  gridEnabled: true,
  gridCell: DEFAULT_BUILDER_GRID_CELL,
  containerSize: { width: 0, height: 0 },

  zoomBy: (direction) =>
    set(({ zoom }) => ({ zoom: stepLadder(zoom, BUILDER_ZOOM_LEVELS, direction) })),

  fit: (sheet) =>
    set(({ containerSize }) => {
      if (!sheet.width || !sheet.height || !containerSize.width) {
        return { zoom: DEFAULT_BUILDER_ZOOM };
      }
      const raw = Math.min(containerSize.width / sheet.width, containerSize.height / sheet.height);
      const level = [...BUILDER_ZOOM_LEVELS].reverse().find((step) => step <= raw);
      return { zoom: level ?? BUILDER_ZOOM_LEVELS[0] };
    }),

  toggleGrid: () => set(({ gridEnabled }) => ({ gridEnabled: !gridEnabled })),
  setGridCell: (gridCell) => set({ gridCell }),
  setContainerSize: (containerSize) => set({ containerSize }),
}));
