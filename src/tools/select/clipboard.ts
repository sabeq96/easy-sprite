import { clamp } from "@/lib/math";
import type { Rect } from "@/lib/rect";
import type { PixelBuffer } from "@/types/pixels";
import type { Selection } from "./selection";

export interface ClipboardEntry {
  /** The copied shape; a Rectangle's is fully set. */
  selection: Selection;
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
        selection: { rect: { ...next.selection.rect }, bits: new Uint8Array(next.selection.bits) },
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
  const source = clip.selection.rect;
  const rect: Rect = {
    ...source,
    x: clamp(source.x, 0, width - source.w),
    y: clamp(source.y, 0, height - source.h),
  };
  return rect.w > width || rect.h > height ? null : rect;
}

