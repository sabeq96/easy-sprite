import type { Rect } from "@/lib/rect";
import type { PixelBuffer } from "@/types/pixels";
import type { Mask } from "./mask";

export interface ClipboardEntry {
  rect: Rect;
  /** The copied shape, over `rect`; a Rectangle's is fully set. */
  mask: Mask;
  pixels: PixelBuffer;
}

/**
 * In-memory and shared by every sprite in the tab. Deliberately not the system clipboard:
 * that only carries images, and the round trip through PNG loses exact alpha.
 */
let entry: ClipboardEntry | null = null;

export function setClipboard(next: ClipboardEntry | null): void {
  entry = next
    ? {
        rect: { ...next.rect },
        mask: { rect: { ...next.mask.rect }, bits: new Uint8Array(next.mask.bits) },
        pixels: new Uint8ClampedArray(next.pixels),
      }
    : null;
}

export function getClipboard(): ClipboardEntry | null {
  return entry;
}

export function hasClipboard(): boolean {
  return entry !== null;
}

/**
 * Where a paste lands: the original position, nudged in-bounds when the canvas is smaller than
 * the source. Null when the clip is bigger than the canvas.
 */
export function pasteRect(clip: ClipboardEntry, width: number, height: number): Rect | null {
  const rect: Rect = {
    ...clip.rect,
    x: Math.max(0, Math.min(clip.rect.x, width - clip.rect.w)),
    y: Math.max(0, Math.min(clip.rect.y, height - clip.rect.h)),
  };
  return rect.w > width || rect.h > height ? null : rect;
}

