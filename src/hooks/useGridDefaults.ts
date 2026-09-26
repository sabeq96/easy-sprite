import { useEffect } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { defaultGridSize } from "@/editor/grid";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { useEditorStore } from "@/stores/useEditorStore";

/**
 * Grid to one tile, chessboard to one pixel — whenever a sprite opens or its tile size changes.
 * Anything the user sets in between is session-only.
 */
export function useGridDefaults(): void {
  const { doc } = useDocumentSession();
  const { tileSize } = useDocumentSnapshot(doc);
  const resetGrid = useEditorStore((state) => state.resetGrid);

  useEffect(() => {
    resetGrid(defaultGridSize(tileSize, doc.width, doc.height));
  }, [doc, tileSize, resetGrid]);
}
