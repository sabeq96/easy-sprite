import { db } from "@/db/db";
import { removeCelsForLayer } from "@/db/repositories/cels";
import { withQuotaGuard } from "@/db/errors";
import type { LayerRecord } from "@/db/schema";

export function saveLayers(layers: LayerRecord[]): Promise<string> {
  return withQuotaGuard(() => db.layers.bulkPut(layers));
}

/** Deletes layers that no longer exist on the document, plus their cels. */
export function pruneLayers(spriteId: string, keepIds: string[]): Promise<void> {
  const keep = new Set(keepIds);
  return db.transaction("rw", db.layers, db.cels, async () => {
    const stale = await db.layers.where("spriteId").equals(spriteId).toArray();
    for (const layer of stale) {
      if (keep.has(layer.id)) continue;
      await removeCelsForLayer(layer.id);
      await db.layers.delete(layer.id);
    }
  });
}

export function removeLayer(layerId: string): Promise<void> {
  return db.transaction("rw", db.layers, db.cels, async () => {
    await removeCelsForLayer(layerId);
    await db.layers.delete(layerId);
  });
}
