import { THUMBNAIL_MAX_PX } from "@/constants/storage";
import { updateSprite } from "@/db/repositories/sprites";
import { updateSpritesheet } from "@/db/repositories/spritesheets";
import type { SpritesheetBlockRecord } from "@/db/schema";
import { compositeFrame } from "@/editor/composite";
import type { SpriteDocument } from "@/editor/document";
import { renderBuilderSheet } from "@/export/spritesheetBuilder";
import { computeBuilderBounds, sizesFromDocs } from "@/export/spritesheetBuilderLayout";

/** Scales a 1× source up by a whole factor, to about THUMBNAIL_MAX_PX, and encodes it. */
async function toThumbnail(source: OffscreenCanvas): Promise<Blob | null> {
  const scale = Math.max(1, Math.floor(THUMBNAIL_MAX_PX / Math.max(source.width, source.height)));
  const canvas = new OffscreenCanvas(source.width * scale, source.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // A blurred pixel-art thumbnail reads as a bug.
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  return canvas.convertToBlob({ type: "image/png" });
}

export async function generateThumbnail(doc: SpriteDocument): Promise<Blob | null> {
  const frame = doc.frames[0];
  if (!frame) return null;
  return toThumbnail(compositeFrame(doc, frame.id));
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

  return toThumbnail(renderBuilderSheet(blocks, docs));
}

export async function saveSpritesheetThumbnail(
  id: string,
  blocks: SpritesheetBlockRecord[],
  docs: Map<string, SpriteDocument>,
): Promise<void> {
  const thumbnail = await generateSpritesheetThumbnail(blocks, docs);
  await updateSpritesheet(id, { thumbnail });
}
