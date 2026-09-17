import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE, SPRITE_SIZE_WARN_BYTES } from "@/constants/canvas";

export interface CanvasSize {
  width: number;
  height: number;
}

export function isValidCanvasSize({ width, height }: CanvasSize): boolean {
  return [width, height].every(
    (value) =>
      Number.isInteger(value) && value >= MIN_CANVAS_SIZE && value <= MAX_CANVAS_SIZE,
  );
}

/** Bytes of pixel data a sprite of this shape would hold. */
export function estimateSpriteBytes(
  size: CanvasSize,
  layerCount: number,
  frameCount: number,
): number {
  return size.width * size.height * 4 * layerCount * frameCount;
}

export function isSpriteOversized(
  size: CanvasSize,
  layerCount = 1,
  frameCount = 1,
): boolean {
  return estimateSpriteBytes(size, layerCount, frameCount) > SPRITE_SIZE_WARN_BYTES;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
