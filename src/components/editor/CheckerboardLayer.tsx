import { CHECKER_GRADIENT, MAX_CHECKER_SIZE } from "@/constants/canvas";
import { snapTileSize, tileSizeOptions } from "@/editor/grid";
import type { Viewport } from "@/editor/viewport";

export interface CheckerboardLayerProps {
  viewport: Viewport;
  width: number;
  height: number;
  tileSize: number;
}

/**
 * CSS rather than a canvas: the checkerboard never changes with the artwork, so keeping it
 * out of the redraw path costs nothing and saves a full-canvas paint per frame. The tile size is
 * snapped to a size that evenly divides the sprite so the last row/column is never a clipped
 * half-tile.
 */
export function CheckerboardLayer({ viewport, width, height, tileSize }: CheckerboardLayerProps) {
  const options = tileSizeOptions(width, height, MAX_CHECKER_SIZE);
  const tile = snapTileSize(tileSize, options) * viewport.scale;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: viewport.originX,
        top: viewport.originY,
        width: width * viewport.scale,
        height: height * viewport.scale,
        backgroundImage: CHECKER_GRADIENT,
        backgroundSize: `${tile * 2}px ${tile * 2}px`,
      }}
    />
  );
}
