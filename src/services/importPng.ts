import { DEFAULT_FPS } from "@/constants/animation";
import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from "@/constants/canvas";
import { THUMBNAIL_MAX_PX } from "@/constants/storage";
import { db } from "@/db/db";
import { withQuotaGuard } from "@/db/errors";
import { isCelEmpty } from "@/db/repositories/cels";
import type { CelRecord, LayerRecord, SpriteRecord } from "@/db/schema";
import { DEFAULT_ITEM_NAME, DEFAULT_LAYER_NAME } from "@/constants/names";
import { nameOrDefault } from "@/lib/format";
import { createId } from "@/lib/id";
import { inferTileSize } from "@/lib/tiles";
import type { PixelBuffer } from "@/types/pixels";

export interface ImportPngResult {
  imported: SpriteRecord[];
  /** Filename paired with why it couldn't be imported. */
  skipped: { name: string; reason: string }[];
}

function baseName(filename: string): string {
  return nameOrDefault(filename.replace(/\.[^./]+$/, ""), DEFAULT_ITEM_NAME);
}

async function decodePng(file: File): Promise<{ pixels: PixelBuffer; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = bitmap;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, width, height);
    // ImageData.data is always backed by a plain ArrayBuffer in browsers.
    return { pixels: data as PixelBuffer, width, height };
  } finally {
    bitmap.close();
  }
}

async function generateImportThumbnail(
  pixels: PixelBuffer,
  width: number,
  height: number,
): Promise<Blob | null> {
  const source = new ImageData(new Uint8ClampedArray(pixels), width, height);
  const scale = Math.max(1, Math.floor(THUMBNAIL_MAX_PX / Math.max(width, height)));
  const canvas = new OffscreenCanvas(width * scale, height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const sourceCanvas = new OffscreenCanvas(width, height);
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) return null;
  sourceCtx.putImageData(source, 0, 0);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: "image/png" });
}

/** Imports one PNG as a new sprite, sized to the image. Rejects anything past the max canvas size. */
async function importPngFile(file: File): Promise<SpriteRecord> {
  const { pixels, width, height } = await decodePng(file);

  if (width < MIN_CANVAS_SIZE || height < MIN_CANVAS_SIZE) {
    throw new Error("Image is empty");
  }
  if (width > MAX_CANVAS_SIZE || height > MAX_CANVAS_SIZE) {
    throw new Error(`Image exceeds the max canvas size (${MAX_CANVAS_SIZE}×${MAX_CANVAS_SIZE})`);
  }

  const now = Date.now();
  const layerId = createId();
  const frameId = createId();

  const sprite: SpriteRecord = {
    id: createId(),
    name: baseName(file.name),
    width,
    height,
    tileSize: inferTileSize(width, height),
    fps: DEFAULT_FPS,
    layerIds: [layerId],
    frames: [{ id: frameId }],
    paletteId: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    thumbnail: await generateImportThumbnail(pixels, width, height),
  };

  const layer: LayerRecord = {
    id: layerId,
    spriteId: sprite.id,
    name: DEFAULT_LAYER_NAME,
    opacity: 1,
    visible: true,
    locked: false,
  };

  const cel: CelRecord = {
    id: `${layerId}:${frameId}`,
    spriteId: sprite.id,
    layerId,
    frameId,
    pixels,
  };

  await withQuotaGuard(() =>
    db.transaction("rw", db.sprites, db.layers, db.cels, async () => {
      await db.sprites.add(sprite);
      await db.layers.add(layer);
      if (!isCelEmpty(pixels)) await db.cels.add(cel);
    }),
  );

  return sprite;
}

/** Imports every PNG in `files` as its own sprite, continuing past individual failures. */
export async function importPngFiles(files: File[]): Promise<ImportPngResult> {
  const imported: SpriteRecord[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const file of files) {
    if (file.type !== "image/png") {
      skipped.push({ name: file.name, reason: "Not a PNG file" });
      continue;
    }
    try {
      imported.push(await importPngFile(file));
    } catch (error) {
      skipped.push({
        name: file.name,
        reason: error instanceof Error ? error.message : "Import failed",
      });
    }
  }

  return { imported, skipped };
}
