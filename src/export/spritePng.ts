import type { SpriteDocument } from "@/editor/document";
import { downloadBlob, pngFilename } from "@/export/download";
import { renderSpriteStrip } from "@/export/spriteStrip";

/** Every frame left-to-right at 1×, visible layers only — the one sprite export, no options. */
export function exportSpritePng(doc: SpriteDocument): Promise<Blob> {
  return renderSpriteStrip(doc).convertToBlob({ type: "image/png" });
}

/** Renders and downloads `doc` as `<sprite name>.png`; resolves to the filename it was saved as. */
export async function downloadSpritePng(doc: SpriteDocument): Promise<string> {
  const filename = pngFilename(doc.name);
  downloadBlob(await exportSpritePng(doc), filename);
  return filename;
}
