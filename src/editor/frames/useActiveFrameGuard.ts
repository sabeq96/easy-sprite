import { useEffect } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { useDocumentRevision } from "@/hooks/useDocumentRevision";
import { useFramesStore } from "./store";

/**
 * Keeps the active frame pointing at a frame that still exists, so no panel has to guard against
 * a stale id after a delete.
 */
export function useActiveFrameGuard(): void {
  const { doc } = useDocumentSession();
  const revision = useDocumentRevision(doc, "structure");

  const activeFrameId = useFramesStore((state) => state.activeFrameId);
  const setActiveFrame = useFramesStore((state) => state.setActiveFrame);

  useEffect(() => {
    if (!activeFrameId || !doc.frames.some((frame) => frame.id === activeFrameId)) {
      setActiveFrame(doc.frames[0].id);
    }
  }, [revision, doc, activeFrameId, setActiveFrame]);
}
