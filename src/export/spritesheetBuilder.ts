import type { SpritesheetBlockRecord } from "@/db/schema";
import type { SpriteDocument } from "@/editor/document";
import { packSheet, sizesFromDocs } from "@/export/spritesheetBuilderLayout";
import { renderSpriteStrip } from "@/export/spriteStrip";

export interface BuilderExportOptions {
  scale: number;
  /** Flatten onto a solid colour instead of exporting transparency. */
  background?: string | null;
  includeHidden?: boolean;
}

export interface BuilderBlockMetadata {
  spriteId: string;
  name: string;
  x: number;
  y: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frames: { index: number; x: number; y: number; w: number; h: number }[];
}

export interface BuilderSheetMetadata {
  width: number;
  height: number;
  blocks: BuilderBlockMetadata[];
}

export interface BuilderSheetResult {
  blob: Blob;
  metadata: BuilderSheetMetadata;
}

/** Composes every placed block's sprite strip onto one sheet, at its packed position. */
export async function exportBuilderSheet(
  blocks: SpritesheetBlockRecord[],
  docs: Map<string, SpriteDocument>,
  options: BuilderExportOptions,
): Promise<BuilderSheetResult> {
  const sheet = packSheet(blocks, sizesFromDocs(docs));
  const scale = options.scale;
  const width = Math.max(1, Math.round(sheet.width * scale));
  const height = Math.max(1, Math.round(sheet.height * scale));

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the export canvas.");

  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, width, height);
  }

  // Non-negotiable: smoothing would blur a 1× sprite scaled up.
  ctx.imageSmoothingEnabled = false;

  const metadataBlocks: BuilderBlockMetadata[] = [];

  // Row-major, as packed — so the metadata reads in the same order as the sheet does.
  for (const packed of sheet.blocks) {
    const doc = docs.get(packed.spriteId);
    if (!doc) continue; // dangling reference — shouldn't happen, skip defensively

    const strip = renderSpriteStrip(doc, { includeHidden: options.includeHidden });
    const destX = packed.x * scale;
    const destY = packed.y * scale;
    ctx.drawImage(strip, destX, destY, strip.width * scale, strip.height * scale);

    const frameWidth = doc.width * scale;
    const frameHeight = doc.height * scale;
    metadataBlocks.push({
      spriteId: packed.spriteId,
      name: doc.name,
      x: destX,
      y: destY,
      frameWidth,
      frameHeight,
      frameCount: doc.frames.length,
      frames: doc.frames.map((_, index) => ({
        index,
        x: destX + index * frameWidth,
        y: destY,
        w: frameWidth,
        h: frameHeight,
      })),
    });
  }

  return {
    blob: await canvas.convertToBlob({ type: "image/png" }),
    metadata: { width, height, blocks: metadataBlocks },
  };
}
