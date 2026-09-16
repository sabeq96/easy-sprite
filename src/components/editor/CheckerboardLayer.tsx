import { CHECKER_TILE_PX } from "@/constants/canvas";
import type { Viewport } from "@/editor/viewport";

export interface CheckerboardLayerProps {
  viewport: Viewport;
  width: number;
  height: number;
}

/**
 * CSS rather than a canvas: the checkerboard never changes with the artwork, so keeping it
 * out of the redraw path costs nothing and saves a full-canvas paint per frame.
 */
export function CheckerboardLayer({ viewport, width, height }: CheckerboardLayerProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: viewport.originX,
        top: viewport.originY,
        width: width * viewport.scale,
        height: height * viewport.scale,
        backgroundImage:
          "conic-gradient(var(--checker-a) 25%, var(--checker-b) 0 50%, var(--checker-a) 0 75%, var(--checker-b) 0)",
        backgroundSize: `${CHECKER_TILE_PX * 2}px ${CHECKER_TILE_PX * 2}px`,
      }}
    />
  );
}
