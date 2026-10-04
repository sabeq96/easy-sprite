import { useEffect } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { openGridSize } from "@/core/grid";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { useDefaultsStore } from "@/stores/useDefaultsStore";
import { useViewStore } from "./store";

/**
 * Grid and checkerboard to the user's defaults whenever a sprite opens or its tile size changes, and
 * the grid on or off whenever a sprite opens. Anything the user sets in between is session-only.
 */
export function useGridReset(): void {
  const { doc } = useDocumentSession();
  const { tileSize } = useDocumentSnapshot(doc);
  const resetGrid = useViewStore((state) => state.resetGrid);
  const setGridEnabled = useViewStore((state) => state.setGridEnabled);

  useEffect(() => {
    const { gridSize, checkerSize } = useDefaultsStore.getState().defaults;
    resetGrid(openGridSize(gridSize, tileSize, doc.width, doc.height), checkerSize);
  }, [doc, tileSize, resetGrid]);

  useEffect(() => {
    setGridEnabled(useDefaultsStore.getState().defaults.gridEnabled);
  }, [doc, setGridEnabled]);
}
