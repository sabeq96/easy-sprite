import { useEffect } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { useDocumentRevision } from "@/hooks/useDocumentRevision";
import { useLayersStore } from "./store";

/**
 * Keeps the active layer pointing at a layer that still exists, so no panel has to guard against
 * a stale id after a delete.
 */
export function useActiveLayerGuard(): void {
  const { doc } = useDocumentSession();
  const revision = useDocumentRevision(doc, "structure");

  const activeLayerId = useLayersStore((state) => state.activeLayerId);
  const setActiveLayer = useLayersStore((state) => state.setActiveLayer);

  useEffect(() => {
    // Default to the topmost layer — that is what a user expects to be drawing on.
    if (!activeLayerId || !doc.layers.some((layer) => layer.id === activeLayerId)) {
      setActiveLayer(doc.layers.at(-1)!.id);
    }
  }, [revision, doc, activeLayerId, setActiveLayer]);
}
