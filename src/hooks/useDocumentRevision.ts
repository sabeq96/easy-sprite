import { useSyncExternalStore } from "react";
import type { Unsubscribe } from "@/core/emitter";

/** Either document kind: a payload-free event and a monotonic counter per channel. */
interface Revisioned<Channel extends string> {
  events: { on(event: Channel, listener: () => void): Unsubscribe };
  revisions: Record<Channel, number>;
}

/**
 * The only correct way for a component to re-render on a document change: the snapshot is a
 * monotonic counter, so it is always a stable primitive.
 */
export function useDocumentRevision<Channel extends string>(
  doc: Revisioned<Channel>,
  channel: Channel,
): number {
  return useSyncExternalStore(
    (onChange) => doc.events.on(channel, onChange),
    () => doc.revisions[channel],
  );
}
