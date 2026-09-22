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

export interface SplitGrid {
  columns: number;
  rows: number;
  frameCount: number;
  /** Trailing px on the right/bottom edge that a grid of `frameSize` tiles doesn't cover. */
  remainderX: number;
  remainderY: number;
}

/** How a sprite of `size` divides into a grid of `frameSize` tiles, left → right, top → bottom. */
export function computeSplitGrid(size: CanvasSize, frameSize: CanvasSize): SplitGrid {
  const columns = Math.floor(size.width / frameSize.width);
  const rows = Math.floor(size.height / frameSize.height);
  return {
    columns,
    rows,
    frameCount: columns * rows,
    remainderX: size.width - columns * frameSize.width,
    remainderY: size.height - rows * frameSize.height,
  };
}

export function isValidSplitFrameSize(size: CanvasSize, frameSize: CanvasSize): boolean {
  return (
    isValidCanvasSize(frameSize) &&
    frameSize.width <= size.width &&
    frameSize.height <= size.height
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
