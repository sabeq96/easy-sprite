import { saveLayers, pruneLayers } from "@/db/repositories/layers";
import { loadSnapshot, updateSprite } from "@/db/repositories/sprites";
import { SpriteDocument } from "@/editor/document";

export async function openDocument(spriteId: string): Promise<SpriteDocument> {
  const { sprite, layers, cels } = await loadSnapshot(spriteId);

  return new SpriteDocument({
    id: sprite.id,
    name: sprite.name,
    width: sprite.width,
    height: sprite.height,
    fps: sprite.fps,
    layers: layers.map(({ id, name, opacity, visible, locked }) => ({
      id,
      name,
      opacity,
      visible,
      locked,
    })),
    frames: sprite.frames.map((frame) => ({ id: frame.id })),
    cels: cels.map(({ layerId, frameId, pixels }) => ({ layerId, frameId, pixels })),
  });
}

/** Persists structure and metadata. Pixels go through the autosave controller separately. */
export async function saveDocumentStructure(doc: SpriteDocument): Promise<void> {
  const layerIds = doc.layers.map((layer) => layer.id);

  await saveLayers(doc.layers.map((layer) => ({ ...layer, spriteId: doc.id })));
  await pruneLayers(doc.id, layerIds);
  await updateSprite(doc.id, {
    name: doc.name,
    width: doc.width,
    height: doc.height,
    fps: doc.fps,
    layerIds,
    frames: doc.frames.map((frame) => ({ id: frame.id })),
  });
}
