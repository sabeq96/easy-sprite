import { useMemo, useSyncExternalStore } from "react";
import type { SpritesheetBlockRecord } from "@/db/schema";
import type {
  SpritesheetDocument,
  SpritesheetRevisionChannel,
} from "@/editor/spritesheetDocument";

export interface SpritesheetSnapshot {
  revision: number;
  id: string;
  name: string;
  tileSize: number;
  blocks: SpritesheetBlockRecord[];
}

function useRevision(doc: SpritesheetDocument, channel: SpritesheetRevisionChannel): number {
  return useSyncExternalStore(
    (onChange) => doc.events.on(channel, onChange),
    () => doc.revisions[channel],
  );
}

/**
 * The only safe way for a component to read an open spritesheet during render — see
 * useDocumentSnapshot for why the revisions are read inside the memo.
 */
export function useSpritesheetSnapshot(doc: SpritesheetDocument): SpritesheetSnapshot {
  const blocks = useRevision(doc, "blocks");
  const meta = useRevision(doc, "meta");

  return useMemo(
    () => ({
      revision: blocks + meta,
      id: doc.id,
      name: doc.name,
      tileSize: doc.tileSize,
      blocks: doc.blocks,
    }),
    [doc, blocks, meta],
  );
}
