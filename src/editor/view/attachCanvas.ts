import { drawGrid } from "@/core/painters/grid";
import type { CanvasRenderer } from "@/core/renderer";
import { useViewStore } from "./store";

/**
 * Registers the pixel-grid painter on the overlay channel, and repaints that channel whenever the
 * grid settings change. Modules attach before any tool, so a tool's overlay draws above the grid.
 */
export function attachGrid(renderer: CanvasRenderer): () => void {
  const removePainter = renderer.addPainter({
    channel: "overlay",
    paint: (p) => {
      const { gridEnabled, gridSize } = useViewStore.getState();
      if (gridEnabled) drawGrid(p, gridSize);
    },
  });

  // The painter reads the store at paint time.
  const unsubscribe = useViewStore.subscribe((state, previous) => {
    if (state.gridEnabled !== previous.gridEnabled || state.gridSize !== previous.gridSize) {
      renderer.invalidate("overlay");
    }
  });

  return () => {
    unsubscribe();
    removePainter();
  };
}
