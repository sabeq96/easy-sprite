import { useEffect, useRef, useState } from "react";
import type { SpriteDocument } from "@/editor/document";
import { openDocument } from "@/services/documentService";

/**
 * Opens (and caches) a SpriteDocument per distinct sprite id. Documents are only ever added, so a
 * sprite dragged off a sheet and back again doesn't reload.
 *
 * Callers derive the ids from state that re-renders on every pointer move during a drag, so a load
 * is never cancelled by the id set changing — only tracked, so it is started once. Each id settles
 * on its own: one sprite that fails to open (deleted in another tab, say) doesn't take the rest of
 * the batch down with it, and is simply not shown.
 */
export function useDocumentCache(spriteIds: string[]): Map<string, SpriteDocument> {
  const [docs, setDocs] = useState<Map<string, SpriteDocument>>(() => new Map());
  const requested = useRef(new Set<string>());
  // Unmount only — a load started for an earlier id set must still land after the set changes.
  const isMounted = useRef(true);
  const key = [...new Set(spriteIds)].sort().join("\n");

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const missing = (key ? key.split("\n") : []).filter((id) => !requested.current.has(id));

    for (const id of missing) {
      requested.current.add(id);
      openDocument(id).then(
        (doc) => {
          if (isMounted.current) setDocs((current) => new Map(current).set(id, doc));
        },
        () => {
          // Forget it, so a later render (the sprite restored, say) can try again.
          requested.current.delete(id);
        },
      );
    }
  }, [key]);

  return docs;
}
