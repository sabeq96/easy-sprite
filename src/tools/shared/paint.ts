import { blendPixel, setPixel } from "@/core/buffer";
import { forEachBrushPixel, forEachLinePixel } from "@/core/pixels";
import type { Surface } from "@/framework/host";
import type { ToolPoint } from "@/framework/tool";
import type { RGBA } from "@/lib/color";
import { rectUnion, type Rect } from "@/lib/rect";

/** Writes one pixel if it is in bounds. Returns true if written. */
export function writePixel(
  surface: Surface,
  x: number,
  y: number,
  color: RGBA,
  replace: boolean,
): boolean {
  const { width, height } = surface;
  if (x < 0 || y < 0 || x >= width || y >= height) return false;

  const pixels = surface.buffer();
  // `replace` for the eraser; blending only matters for a semi-transparent colour.
  if (replace || color.a === 255) setPixel(pixels, x, y, width, color);
  else blendPixel(pixels, x, y, width, color);
  return true;
}

export interface StampOptions {
  color: RGBA;
  size: number;
  replace?: boolean;
  mirrorHorizontal?: boolean;
  mirrorVertical?: boolean;
}

/** One brush stamp including its mirrored copies. Returns the union rect actually written. */
export function stamp(surface: Surface, point: ToolPoint, options: StampOptions): Rect | null {
  const { width, height } = surface;
  const positions: ToolPoint[] = [point];

  if (options.mirrorHorizontal) positions.push({ x: width - 1 - point.x, y: point.y });
  if (options.mirrorVertical) positions.push({ x: point.x, y: height - 1 - point.y });
  if (options.mirrorHorizontal && options.mirrorVertical) {
    positions.push({ x: width - 1 - point.x, y: height - 1 - point.y });
  }

  let dirty: Rect | null = null;
  for (const position of positions) {
    forEachBrushPixel(position.x, position.y, options.size, (x, y) => {
      if (writePixel(surface, x, y, options.color, options.replace ?? false)) {
        dirty = rectUnion(dirty, { x, y, w: 1, h: 1 });
      }
    });
  }
  return dirty;
}

/** Stamps along a line, joining two sampled pointer positions. */
export function stampLine(
  surface: Surface,
  from: ToolPoint,
  to: ToolPoint,
  options: StampOptions,
): Rect | null {
  let dirty: Rect | null = null;
  forEachLinePixel(from.x, from.y, to.x, to.y, (x, y) => {
    const written = stamp(surface, { x, y }, options);
    if (written) dirty = rectUnion(dirty, written);
  });
  return dirty;
}
