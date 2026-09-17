import { useEffect } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { useEditorStore } from "@/stores/useEditorStore";

/**
 * A selection is geometry over the canvas, so it survives layer and frame changes but not a
 * resize — the mask is sized to the old canvas and would be silently wrong.
 */
export function useSelectionLifecycle(): void {
  const { doc } = useDocumentSession();
  const clearSelection = useEditorStore((state) => state.clearSelection);

  useEffect(() => {
    let lastWidth = doc.width;
    let lastHeight = doc.height;

    return doc.events.on("meta", () => {
      if (doc.width === lastWidth && doc.height === lastHeight) return;
      lastWidth = doc.width;
      lastHeight = doc.height;
      clearSelection();
    });
  }, [doc, clearSelection]);

  // Leaving the sprite drops the selection with it.
  useEffect(() => clearSelection, [doc, clearSelection]);
}
