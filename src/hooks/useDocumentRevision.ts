import { useSyncExternalStore } from "react";
import type { RevisionChannel, SpriteDocument } from "@/editor/document";

/**
 * The only correct way for a component to re-render on a document change: the snapshot is a
 * monotonic counter, so it is always a stable primitive.
 */
export function useDocumentRevision(doc: SpriteDocument, channel: RevisionChannel): number {
  return useSyncExternalStore(
    (onChange) => doc.events.on(channel, onChange),
    () => doc.revisions[channel],
  );
}
