import { clearRegion, cropRegion, pasteRegion } from "@/editor/buffer";
import { getClipboard, setClipboard } from "@/editor/clipboard";
import type { SpriteDocument } from "@/editor/document";
import type { Command } from "@/editor/history";
import type { Rect } from "@/lib/rect";

export interface EditTarget {
  doc: SpriteDocument;
  layerId: string;
  frameId: string;
}

export function copySelection(target: EditTarget, rect: Rect): boolean {
  const cel = target.doc.getCel(target.layerId, target.frameId);
  if (!cel) return false;

  setClipboard({ rect, pixels: cropRegion(cel.pixels, target.doc.width, rect) });
  return true;
}

/** Shared by cut and delete: they differ only in whether the clipboard is filled first. */
export function clearSelectionCommand(
  target: EditTarget,
  rect: Rect,
  label: string,
): Command | null {
  const { doc, layerId, frameId } = target;
  const cel = doc.getCel(layerId, frameId);
  if (!cel) return null;

  const before = cropRegion(cel.pixels, doc.width, rect);

  const apply = () => {
    clearRegion(cel.pixels, doc.width, rect);
    doc.markPixelsChanged(cel, rect);
  };
  apply();

  return {
    label,
    sizeBytes: before.length,
    undo: () => {
      pasteRegion(cel.pixels, doc.width, rect, before);
      doc.markPixelsChanged(cel, rect);
    },
    redo: apply,
  };
}

export function cutSelectionCommand(target: EditTarget, rect: Rect): Command | null {
  if (!copySelection(target, rect)) return null;
  return clearSelectionCommand(target, rect, "Cut");
}

/**
 * Pastes at the original position, nudged in-bounds when the canvas is smaller than the
 * source. Replaces the destination region wholesale, so undo is one rectangle swap.
 */
export function pasteCommand(target: EditTarget): { command: Command; rect: Rect } | null {
  const clip = getClipboard();
  if (!clip) return null;

  const { doc, layerId, frameId } = target;
  const cel = doc.ensureCel(layerId, frameId);

  const rect: Rect = {
    ...clip.rect,
    x: Math.max(0, Math.min(clip.rect.x, doc.width - clip.rect.w)),
    y: Math.max(0, Math.min(clip.rect.y, doc.height - clip.rect.h)),
  };
  if (rect.w > doc.width || rect.h > doc.height) return null;

  const before = cropRegion(cel.pixels, doc.width, rect);
  const apply = () => {
    pasteRegion(cel.pixels, doc.width, rect, clip.pixels);
    doc.markPixelsChanged(cel, rect);
  };
  apply();

  return {
    rect,
    command: {
      label: "Paste",
      sizeBytes: before.length * 2,
      undo: () => {
        pasteRegion(cel.pixels, doc.width, rect, before);
        doc.markPixelsChanged(cel, rect);
      },
      redo: apply,
    },
  };
}
