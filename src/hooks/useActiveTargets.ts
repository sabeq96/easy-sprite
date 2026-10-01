import { useEffect } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { useDocumentRevision } from "@/hooks/useDocumentRevision";
import { useEditorStore } from "@/stores/useEditorStore";

/**
 * Keeps the active frame pointing at something that still exists, so no panel has to guard
 * against a stale id after a delete. The layers module guards the active layer.
 */
export function useActiveTargets(): void {
  const { doc } = useDocumentSession();
  const revision = useDocumentRevision(doc, "structure");

  const activeFrameId = useEditorStore((state) => state.activeFrameId);
  const setActiveFrame = useEditorStore((state) => state.setActiveFrame);

  useEffect(() => {
    if (!activeFrameId || !doc.frames.some((frame) => frame.id === activeFrameId)) {
      setActiveFrame(doc.frames[0].id);
    }
  }, [revision, doc, activeFrameId, setActiveFrame]);
}
