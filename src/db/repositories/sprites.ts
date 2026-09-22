import { DEFAULT_CANVAS_SIZE } from "@/constants/canvas";
import { DEFAULT_FPS } from "@/constants/animation";
import { db } from "@/db/db";
import { NotFoundError, withQuotaGuard } from "@/db/errors";
import { celKey, isCelEmpty } from "@/db/repositories/cels";
import type { CelRecord, FrameMeta, LayerRecord, SpriteRecord } from "@/db/schema";
import { createId } from "@/lib/id";
import type { PixelBuffer } from "@/types/pixels";

export interface SpriteSnapshot {
  sprite: SpriteRecord;
  /** Already ordered bottom → top. */
  layers: LayerRecord[];
  cels: CelRecord[];
}

export interface CreateSpriteOptions {
  name?: string;
  width?: number;
  height?: number;
  fps?: number;
  paletteId?: string | null;
}

export async function createSprite(options: CreateSpriteOptions = {}): Promise<SpriteRecord> {
  const now = Date.now();
  const layerId = createId();
  const sprite: SpriteRecord = {
    id: createId(),
    name: options.name?.trim() || "Untitled",
    width: options.width ?? DEFAULT_CANVAS_SIZE,
    height: options.height ?? DEFAULT_CANVAS_SIZE,
    fps: options.fps ?? DEFAULT_FPS,
    layerIds: [layerId],
    frames: [{ id: createId() }],
    paletteId: options.paletteId ?? null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    thumbnail: null,
  };

  await withQuotaGuard(() =>
    db.transaction("rw", db.sprites, db.layers, async () => {
      await db.sprites.add(sprite);
      await db.layers.add({
        id: layerId,
        spriteId: sprite.id,
        name: "Layer 1",
        opacity: 1,
        visible: true,
        locked: false,
      });
      // No cel row: an empty cel is implicit.
    }),
  );

  return sprite;
}

export function listSprites(): Promise<SpriteRecord[]> {
  return db.sprites.orderBy("updatedAt").reverse().toArray();
}

export async function getSprite(id: string): Promise<SpriteRecord> {
  const sprite = await db.sprites.get(id);
  if (!sprite) throw new NotFoundError("Sprite", id);
  return sprite;
}

/** Everything the editor needs to open a document, in one read transaction. */
export function loadSnapshot(id: string): Promise<SpriteSnapshot> {
  return db.transaction("r", db.sprites, db.layers, db.cels, async () => {
    const sprite = await getSprite(id);
    const layers = await db.layers.where("spriteId").equals(id).toArray();
    const cels = await db.cels.where("spriteId").equals(id).toArray();

    const order = new Map(sprite.layerIds.map((layerId, index) => [layerId, index]));
    layers.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    return { sprite, layers, cels };
  });
}

export function updateSprite(
  id: string,
  patch: Partial<Omit<SpriteRecord, "id" | "createdAt">>,
): Promise<number> {
  return withQuotaGuard(() => db.sprites.update(id, { ...patch, updatedAt: Date.now() }));
}

export async function duplicateSprite(id: string): Promise<SpriteRecord> {
  const { sprite, layers, cels } = await loadSnapshot(id);
  const now = Date.now();

  // Remap every id so the copy is fully independent of the original.
  const layerIdMap = new Map(layers.map((layer) => [layer.id, createId()]));
  const frameIdMap = new Map(sprite.frames.map((frame) => [frame.id, createId()]));

  const copy: SpriteRecord = {
    ...sprite,
    id: createId(),
    name: `${sprite.name} copy`,
    layerIds: sprite.layerIds.map((layerId) => layerIdMap.get(layerId) ?? createId()),
    frames: sprite.frames.map((frame) => ({ ...frame, id: frameIdMap.get(frame.id)! })),
    createdAt: now,
    updatedAt: now,
  };

  const copiedLayers: LayerRecord[] = layers.map((layer) => ({
    ...layer,
    id: layerIdMap.get(layer.id)!,
    spriteId: copy.id,
  }));

  const copiedCels: CelRecord[] = cels.map((cel) => {
    const layerId = layerIdMap.get(cel.layerId)!;
    const frameId = frameIdMap.get(cel.frameId)!;
    return {
      id: celKey(layerId, frameId),
      spriteId: copy.id,
      layerId,
      frameId,
      pixels: new Uint8ClampedArray(cel.pixels), // copy the buffer, never share it
    };
  });

  await withQuotaGuard(() =>
    db.transaction("rw", db.sprites, db.layers, db.cels, async () => {
      await db.sprites.add(copy);
      await db.layers.bulkAdd(copiedLayers);
      await db.cels.bulkAdd(copiedCels);
    }),
  );

  return copy;
}

/** Copies a `w`×`h` region out of a `srcWidth`-wide RGBA buffer, starting at (`x`, `y`). */
function cropPixels(
  src: PixelBuffer,
  srcWidth: number,
  x: number,
  y: number,
  w: number,
  h: number,
): PixelBuffer {
  const out = new Uint8ClampedArray(w * h * 4) as PixelBuffer;
  const rowBytes = w * 4;
  for (let row = 0; row < h; row++) {
    const from = ((y + row) * srcWidth + x) * 4;
    out.set(src.subarray(from, from + rowBytes), row * rowBytes);
  }
  return out;
}

/**
 * Replaces every frame with a grid of `frameWidth`×`frameHeight` tiles cut out of each existing
 * frame, in reading order (left → right, top → bottom), then in frame order. Existing frames past
 * the grid's right/bottom edge are cropped off. Destructive: the original frames are gone.
 */
export async function splitSpriteIntoFrames(
  id: string,
  frameWidth: number,
  frameHeight: number,
): Promise<SpriteRecord> {
  const { sprite, layers, cels } = await loadSnapshot(id);
  const columns = Math.floor(sprite.width / frameWidth);
  const rows = Math.floor(sprite.height / frameHeight);
  if (columns < 1 || rows < 1) {
    throw new Error("Frame size is larger than the sprite.");
  }

  const celsByKey = new Map(cels.map((cel) => [celKey(cel.layerId, cel.frameId), cel]));

  const newFrames: FrameMeta[] = [];
  const newCels: CelRecord[] = [];

  for (const frame of sprite.frames) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const newFrameId = createId();
        newFrames.push({ id: newFrameId });

        for (const layer of layers) {
          const source = celsByKey.get(celKey(layer.id, frame.id));
          if (!source) continue;

          const pixels = cropPixels(
            source.pixels,
            sprite.width,
            col * frameWidth,
            row * frameHeight,
            frameWidth,
            frameHeight,
          );
          if (isCelEmpty(pixels)) continue;

          newCels.push({
            id: celKey(layer.id, newFrameId),
            spriteId: id,
            layerId: layer.id,
            frameId: newFrameId,
            pixels,
          });
        }
      }
    }
  }

  const updated: SpriteRecord = {
    ...sprite,
    width: frameWidth,
    height: frameHeight,
    frames: newFrames,
    thumbnail: null,
    updatedAt: Date.now(),
  };

  await withQuotaGuard(() =>
    db.transaction("rw", db.sprites, db.cels, async () => {
      await db.cels.where("spriteId").equals(id).delete();
      await db.cels.bulkAdd(newCels);
      await db.sprites.put(updated);
    }),
  );

  return updated;
}

export function removeSprite(id: string): Promise<void> {
  return db.transaction("rw", db.sprites, db.layers, db.cels, db.spritesheets, async () => {
    await db.cels.where("spriteId").equals(id).delete();
    await db.layers.where("spriteId").equals(id).delete();
    await db.sprites.delete(id);

    // A spritesheet block pointing at this sprite would otherwise be a dangling reference.
    const affected = await db.spritesheets
      .filter((sheet) => sheet.blocks.some((block) => block.spriteId === id))
      .toArray();
    await Promise.all(
      affected.map((sheet) =>
        db.spritesheets.update(sheet.id, {
          blocks: sheet.blocks.filter((block) => block.spriteId !== id),
        }),
      ),
    );
  });
}
