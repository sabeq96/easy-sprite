import { brushBounds } from "@/core/pixels";
import type { Point } from "@/core/viewport";
import type { OverlayPaint } from "@/framework/host";

/** What the brush preview draws: where, how big, which mirrored copies, and on what sprite. */
export interface BrushCursor {
  point: Point;
  size: number;
  mirrorHorizontal: boolean;
  mirrorVertical: boolean;
  sprite: { width: number; height: number };
}

/** Highlights the pixels the brush would cover, including mirrored copies. */
export function brushCursorPainter(getCursor: () => BrushCursor | null): OverlayPaint {
  return (ctx, viewport) => {
    const cursor = getCursor();
    if (!cursor) return;
    const { point, size, sprite } = cursor;
    // No preview once the pointer leaves the sprite — hovering the padding around
    // the canvas shouldn't light up pixels that don't exist.
    if (point.x < 0 || point.y < 0 || point.x >= sprite.width || point.y >= sprite.height) {
      return;
    }

    const points: Point[] = [point];
    if (cursor.mirrorHorizontal) points.push({ x: sprite.width - 1 - point.x, y: point.y });
    if (cursor.mirrorVertical) points.push({ x: point.x, y: sprite.height - 1 - point.y });
    if (cursor.mirrorHorizontal && cursor.mirrorVertical) {
      points.push({ x: sprite.width - 1 - point.x, y: sprite.height - 1 - point.y });
    }

    ctx.save();

    for (const [index, position] of points.entries()) {
      const bounds = brushBounds(position.x, position.y, size);
      // Clamp to the sprite so a brush footprint near an edge doesn't spill into the padding.
      const left = Math.max(bounds.x, 0);
      const top = Math.max(bounds.y, 0);
      const right = Math.min(bounds.x + bounds.w, sprite.width);
      const bottom = Math.min(bounds.y + bounds.h, sprite.height);
      if (right <= left || bottom <= top) continue;

      const x = viewport.originX + left * viewport.scale;
      const y = viewport.originY + top * viewport.scale;
      const width = (right - left) * viewport.scale;
      const height = (bottom - top) * viewport.scale;

      // Mirrored previews are dimmer so the real cursor stays identifiable.
      ctx.fillStyle = index === 0 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.18)";
      ctx.fillRect(x, y, width, height);
    }

    ctx.restore();
  };
}
