import type { SpriteDocument } from "@/editor/document";
import { downloadBlob } from "@/export/download";
import { renderSpriteStrip } from "@/export/spriteStrip";

/** Every frame left-to-right at 1×, visible layers only — the one sprite export, no options. */
export function exportSpritePng(doc: SpriteDocument): Promise<Blob> {
  return renderSpriteStrip(doc).convertToBlob({ type: "image/png" });
}

/** `Hero Walk` → `Hero Walk.png`: the file is named after the sprite, nothing more. */
export function spritePngFilename(name: string): string {
  return `${name.trim() || "sprite"}.png`;
}

/** Renders and downloads `doc`; resolves to the filename it was saved as. */
export async function downloadSpritePng(doc: SpriteDocument): Promise<string> {
  const filename = spritePngFilename(doc.name);
  downloadBlob(await exportSpritePng(doc), filename);
  return filename;
}
