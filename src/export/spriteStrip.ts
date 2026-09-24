import { compositeFrame } from "@/editor/composite";
import type { SpriteDocument } from "@/editor/document";

/** All of a sprite's frames, visible layers only, laid out left-to-right in one 1× canvas. */
export function renderSpriteStrip(doc: SpriteDocument): OffscreenCanvas {
  const canvas = new OffscreenCanvas(doc.width * doc.frames.length, doc.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;

  const scratch = new OffscreenCanvas(doc.width, doc.height);
  doc.frames.forEach((frame, index) => {
    const source = compositeFrame(doc, frame.id, scratch);
    ctx.drawImage(source, index * doc.width, 0);
  });

  return canvas;
}
