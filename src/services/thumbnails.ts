import { THUMBNAIL_MAX_PX } from "@/constants/storage";
import { updateSprite } from "@/db/repositories/sprites";
import { updateSpritesheet } from "@/db/repositories/spritesheets";
import type { SpritesheetBlockRecord } from "@/db/schema";
import { compositeFrame } from "@/editor/composite";
import type { SpriteDocument } from "@/editor/document";
import { exportBuilderSheet } from "@/export/spritesheetBuilder";
import { computeBuilderBounds, sizesFromDocs } from "@/export/spritesheetBuilderLayout";

export async function generateThumbnail(doc: SpriteDocument): Promise<Blob | null> {
  const frame = doc.frames[0];
  if (!frame) return null;

  const source = compositeFrame(doc, frame.id);
  const scale = Math.max(1, Math.floor(THUMBNAIL_MAX_PX / Math.max(doc.width, doc.height)));
  const canvas = new OffscreenCanvas(doc.width * scale, doc.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // A blurred pixel-art thumbnail reads as a bug.
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  return canvas.convertToBlob({ type: "image/png" });
}

export async function saveThumbnail(doc: SpriteDocument): Promise<void> {
  const thumbnail = await generateThumbnail(doc);
  if (thumbnail) await updateSprite(doc.id, { thumbnail });
}

export async function generateSpritesheetThumbnail(
  blocks: SpritesheetBlockRecord[],
  docs: Map<string, SpriteDocument>,
): Promise<Blob | null> {
  const bounds = computeBuilderBounds(blocks, sizesFromDocs(docs));
  if (bounds.width === 0 || bounds.height === 0) return null;

  const scale = Math.max(1, Math.floor(THUMBNAIL_MAX_PX / Math.max(bounds.width, bounds.height)));
  const { blob } = await exportBuilderSheet(blocks, docs, { scale });
  return blob;
}

export async function saveSpritesheetThumbnail(
  id: string,
  blocks: SpritesheetBlockRecord[],
  docs: Map<string, SpriteDocument>,
): Promise<void> {
  const thumbnail = await generateSpritesheetThumbnail(blocks, docs);
  await updateSpritesheet(id, { thumbnail });
}
