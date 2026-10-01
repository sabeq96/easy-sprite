import { blendPixel, setPixel } from "@/editor/buffer";
import { forEachBrushPixel, forEachLinePixel } from "@/editor/pixels";
import type { ToolContext, ToolPoint } from "@/editor/tools/types";
import type { RGBA } from "@/lib/color";
import { rectUnion, type Rect } from "@/lib/rect";

/** Writes one pixel if it is in bounds. Returns true if written. */
export function writePixel(
  ctx: ToolContext,
  x: number,
  y: number,
  color: RGBA,
  replace: boolean,
): boolean {
  const { doc } = ctx;
  if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return false;

  const cel = doc.ensureCel(ctx.layerId, ctx.frameId);
  // `replace` for the eraser; blending only matters for a semi-transparent colour.
  if (replace || color.a === 255) setPixel(cel.pixels, x, y, doc.width, color);
  else blendPixel(cel.pixels, x, y, doc.width, color);
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
export function stamp(ctx: ToolContext, point: ToolPoint, options: StampOptions): Rect | null {
  const { doc } = ctx;
  const positions: ToolPoint[] = [point];

  if (options.mirrorHorizontal) positions.push({ x: doc.width - 1 - point.x, y: point.y });
  if (options.mirrorVertical) positions.push({ x: point.x, y: doc.height - 1 - point.y });
  if (options.mirrorHorizontal && options.mirrorVertical) {
    positions.push({ x: doc.width - 1 - point.x, y: doc.height - 1 - point.y });
  }

  let dirty: Rect | null = null;
  for (const position of positions) {
    forEachBrushPixel(position.x, position.y, options.size, (x, y) => {
      if (writePixel(ctx, x, y, options.color, options.replace ?? false)) {
        dirty = rectUnion(dirty, { x, y, w: 1, h: 1 });
      }
    });
  }
  return dirty;
}

/** Stamps along a line, joining two sampled pointer positions. */
export function stampLine(
  ctx: ToolContext,
  from: ToolPoint,
  to: ToolPoint,
  options: StampOptions,
): Rect | null {
  let dirty: Rect | null = null;
  forEachLinePixel(from.x, from.y, to.x, to.y, (x, y) => {
    const written = stamp(ctx, { x, y }, options);
    if (written) dirty = rectUnion(dirty, written);
  });
  return dirty;
}

/** Records the change and notifies the renderer. Every tool ends its write with this. */
export function commitWrite(ctx: ToolContext, dirty: Rect | null): void {
  if (!dirty || dirty.w === 0) return;
  const cel = ctx.doc.ensureCel(ctx.layerId, ctx.frameId);
  ctx.stroke.extend(ctx.layerId, ctx.frameId, dirty);
  ctx.doc.markPixelsChanged(cel, dirty);
}
