import { useMemo } from "react";
import type { SpritesheetBlockRecord } from "@/db/schema";
import type { SpritesheetDocument } from "@/core/spritesheetDocument";
import { useDocumentRevision } from "@/hooks/useDocumentRevision";

export interface SpritesheetSnapshot {
  revision: number;
  id: string;
  name: string;
  tileSize: number;
  blocks: SpritesheetBlockRecord[];
}

/**
 * The only safe way for a component to read an open spritesheet during render — see
 * useDocumentSnapshot for why the revisions are read inside the memo.
 */
export function useSpritesheetSnapshot(doc: SpritesheetDocument): SpritesheetSnapshot {
  const blocks = useDocumentRevision(doc, "blocks");
  const meta = useDocumentRevision(doc, "meta");

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
