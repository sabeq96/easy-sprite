import type { SpritesheetBlockRecord } from "@/db/schema";
import type { SpriteDocument } from "@/editor/document";
import { downloadBlob, pngFilename } from "@/export/download";
import { packSheet, sizesFromDocs } from "@/export/spritesheetBuilderLayout";
import { renderSpriteStrip } from "@/export/spriteStrip";

/** Composes every placed block's sprite strip onto one 1× sheet, at its packed position. */
export function renderBuilderSheet(
  blocks: SpritesheetBlockRecord[],
  docs: Map<string, SpriteDocument>,
): OffscreenCanvas {
  const sheet = packSheet(blocks, sizesFromDocs(docs));
  const canvas = new OffscreenCanvas(Math.max(1, sheet.width), Math.max(1, sheet.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the export canvas.");

  for (const packed of sheet.blocks) {
    const doc = docs.get(packed.spriteId);
    if (!doc) continue; // dangling reference — shouldn't happen, skip defensively
    ctx.drawImage(renderSpriteStrip(doc), packed.x, packed.y);
  }

  return canvas;
}

/** The one spritesheet export, no options: the composed sheet as a PNG. */
export function exportBuilderSheetPng(
  blocks: SpritesheetBlockRecord[],
  docs: Map<string, SpriteDocument>,
): Promise<Blob> {
  return renderBuilderSheet(blocks, docs).convertToBlob({ type: "image/png" });
}

/** Renders and downloads the sheet as `<name>.png`; resolves to the filename it was saved as. */
export async function downloadBuilderSheetPng(
  name: string,
  blocks: SpritesheetBlockRecord[],
  docs: Map<string, SpriteDocument>,
): Promise<string> {
  const filename = pngFilename(name);
  downloadBlob(await exportBuilderSheetPng(blocks, docs), filename);
  return filename;
}
