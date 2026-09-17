import { useMemo } from "react";
import type { FrameModel, LayerModel, SpriteDocument } from "@/editor/document";
import { useDocumentRevision } from "@/hooks/useDocumentRevision";

export interface DocumentSnapshot {
  /** Bumped on every structural or metadata change; safe to use as a render key. */
  revision: number;
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  /** Bottom → top, copied so later mutations cannot alias what React rendered. */
  layers: LayerModel[];
  frames: FrameModel[];
}

/**
 * The only safe way for a component to read document structure during render.
 *
 * `SpriteDocument` mutates in place and its reference never changes, so components that read
 * its fields directly get memoised forever by the React Compiler. This derives a fresh,
 * immutable snapshot whenever a revision counter ticks.
 *
 * `revision` is deliberately read *inside* the memo: the React Compiler infers dependencies
 * from what the callback actually uses and ignores the declared array, so a revision that only
 * appeared in the deps list would not invalidate anything.
 */
export function useDocumentSnapshot(doc: SpriteDocument): DocumentSnapshot {
  const structure = useDocumentRevision(doc, "structure");
  const meta = useDocumentRevision(doc, "meta");

  return useMemo(
    () => ({
      revision: structure + meta,
      id: doc.id,
      name: doc.name,
      width: doc.width,
      height: doc.height,
      fps: doc.fps,
      // Layer objects are mutated by setLayerProps, so copy each one, not just the array.
      layers: doc.layers.map((layer) => ({ ...layer })),
      frames: doc.frames.map((frame) => ({ ...frame })),
    }),
    [doc, structure, meta],
  );
}
