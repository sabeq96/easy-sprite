import type { Rect } from "@/lib/rect";
import type { PixelBuffer } from "@/types/pixels";

export interface ClipboardEntry {
  rect: Rect;
  pixels: PixelBuffer;
}

/**
 * In-memory and shared by every sprite in the tab. Deliberately not the system clipboard:
 * that only carries images, and the round trip through PNG loses exact alpha.
 */
let entry: ClipboardEntry | null = null;

export function setClipboard(next: ClipboardEntry | null): void {
  entry = next
    ? { rect: { ...next.rect }, pixels: new Uint8ClampedArray(next.pixels) }
    : null;
}

export function getClipboard(): ClipboardEntry | null {
  return entry;
}

export function hasClipboard(): boolean {
  return entry !== null;
}
