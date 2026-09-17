import type { SpritesheetLayout } from "@/constants/export";
import { compositeFrame } from "@/editor/composite";
import type { SpriteDocument } from "@/editor/document";
import { computeSheetLayout, type SheetLayout } from "@/export/spritesheetLayout";

export interface SpritesheetOptions {
  layout: SpritesheetLayout;
  columns?: number;
  scale: number;
  padding?: number;
  margin?: number;
  includeHidden?: boolean;
  /** Flatten onto a solid colour instead of exporting transparency. */
  background?: string | null;
}

export interface SpritesheetMetadata {
  name: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns: number;
  rows: number;
  fps: number;
  frames: { index: number; x: number; y: number; w: number; h: number }[];
}

export interface SpritesheetResult {
  blob: Blob;
  layout: SheetLayout;
  metadata: SpritesheetMetadata;
}

export function layoutFor(doc: SpriteDocument, options: SpritesheetOptions): SheetLayout {
  return computeSheetLayout({
    frameCount: doc.frames.length,
    frameWidth: doc.width,
    frameHeight: doc.height,
    layout: options.layout,
    columns: options.columns,
    scale: options.scale,
    padding: options.padding,
    margin: options.margin,
  });
}

export async function exportSpritesheet(
  doc: SpriteDocument,
  options: SpritesheetOptions,
): Promise<SpritesheetResult> {
  const layout = layoutFor(doc, options);
  const canvas = new OffscreenCanvas(layout.width, layout.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the export canvas.");

  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, layout.width, layout.height);
  }

  // Non-negotiable: smoothing would blur a 1× sprite scaled to 8×.
  ctx.imageSmoothingEnabled = false;

  const scratch = new OffscreenCanvas(doc.width, doc.height);
  doc.frames.forEach((frame, index) => {
    const source = compositeFrame(doc, frame.id, scratch, {
      includeHidden: options.includeHidden,
    });
    const target = layout.frames[index];
    ctx.drawImage(source, target.x, target.y, target.w, target.h);
  });

  return {
    blob: await canvas.convertToBlob({ type: "image/png" }),
    layout,
    metadata: {
      name: doc.name,
      frameWidth: doc.width * options.scale,
      frameHeight: doc.height * options.scale,
      frameCount: doc.frames.length,
      columns: layout.columns,
      rows: layout.rows,
      fps: doc.fps,
      frames: layout.frames.map((rect, index) => ({ index, ...rect })),
    },
  };
}

/** Single frame at the same scaling rules — used by "Export current frame". */
export async function exportFramePng(
  doc: SpriteDocument,
  frameId: string,
  scale = 1,
): Promise<Blob> {
  const source = compositeFrame(doc, frameId);
  const canvas = new OffscreenCanvas(doc.width * scale, doc.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the export canvas.");

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: "image/png" });
}
