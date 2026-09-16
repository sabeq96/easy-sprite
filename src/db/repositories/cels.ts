import { db } from "@/db/db";
import { withQuotaGuard } from "@/db/errors";
import type { CelRecord } from "@/db/schema";
import type { PixelBuffer } from "@/types/pixels";

export function celKey(layerId: string, frameId: string): string {
  return `${layerId}:${frameId}`;
}

export interface CelWrite {
  spriteId: string;
  layerId: string;
  frameId: string;
  pixels: PixelBuffer;
}

/** True when nothing is visible — such cels are deleted rather than stored. */
export function isCelEmpty(pixels: PixelBuffer): boolean {
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] !== 0) return false;
  }
  return true;
}

/**
 * One transaction per autosave flush: writes non-empty cels, deletes emptied ones.
 * Buffers are copied because the caller keeps drawing into the live array while the
 * structured clone is in flight.
 */
export function flushCels(writes: CelWrite[]): Promise<void> {
  const toPut: CelRecord[] = [];
  const toDelete: string[] = [];

  for (const write of writes) {
    const id = celKey(write.layerId, write.frameId);
    if (isCelEmpty(write.pixels)) toDelete.push(id);
    else toPut.push({ id, ...write, pixels: new Uint8ClampedArray(write.pixels) });
  }

  return withQuotaGuard(() =>
    db.transaction("rw", db.cels, async () => {
      if (toPut.length) await db.cels.bulkPut(toPut);
      if (toDelete.length) await db.cels.bulkDelete(toDelete);
    }),
  );
}

export function removeCelsForLayer(layerId: string): Promise<number> {
  return db.cels.where("layerId").equals(layerId).delete();
}

export function removeCelsForFrame(frameId: string): Promise<number> {
  return db.cels.where("frameId").equals(frameId).delete();
}

export function getCel(layerId: string, frameId: string): Promise<CelRecord | undefined> {
  return db.cels.get(celKey(layerId, frameId));
}
