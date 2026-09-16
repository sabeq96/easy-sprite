import { THUMBNAIL_MAX_PX } from "@/constants/storage";
import { updateSprite } from "@/db/repositories/sprites";
import { compositeFrame } from "@/editor/composite";
import type { SpriteDocument } from "@/editor/document";

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
