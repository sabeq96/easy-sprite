import { useEffect } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { useDocumentRevision } from "@/hooks/useDocumentRevision";
import { useEditorStore } from "@/stores/useEditorStore";

export interface ActiveTargets {
  layerId: string | null;
  frameId: string | null;
}

/**
 * Keeps the active layer/frame pointing at something that still exists, so no panel has to
 * guard against a stale id after a delete.
 */
export function useActiveTargets(): ActiveTargets {
  const { doc } = useDocumentSession();
  const revision = useDocumentRevision(doc, "structure");

  const activeLayerId = useEditorStore((state) => state.activeLayerId);
  const activeFrameId = useEditorStore((state) => state.activeFrameId);
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);
  const setActiveFrame = useEditorStore((state) => state.setActiveFrame);

  useEffect(() => {
    // Default to the topmost layer — that is what a user expects to be drawing on.
    if (!activeLayerId || !doc.layers.some((layer) => layer.id === activeLayerId)) {
      setActiveLayer(doc.layers.at(-1)!.id);
    }
    if (!activeFrameId || !doc.frames.some((frame) => frame.id === activeFrameId)) {
      setActiveFrame(doc.frames[0].id);
    }
  }, [revision, doc, activeLayerId, activeFrameId, setActiveLayer, setActiveFrame]);

  return { layerId: activeLayerId, frameId: activeFrameId };
}
