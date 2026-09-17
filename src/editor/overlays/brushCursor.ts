import { brushBounds } from "@/editor/pixels";
import type { OverlayPainter } from "@/editor/renderer";
import type { ToolPoint } from "@/editor/tools/types";

/** Highlights the pixels the brush would cover, including mirrored copies. */
export function brushCursorPainter(
  getPoint: () => ToolPoint | null,
  getSize: () => number,
  sprite: { width: number; height: number },
  mirror: { horizontal: boolean; vertical: boolean },
): OverlayPainter {
  return (ctx, viewport) => {
    const point = getPoint();
    // No preview once the pointer leaves the sprite — hovering the padding around
    // the canvas shouldn't light up pixels that don't exist.
    if (!point || point.x < 0 || point.y < 0 || point.x >= sprite.width || point.y >= sprite.height) {
      return;
    }

    const points: ToolPoint[] = [point];
    if (mirror.horizontal) points.push({ x: sprite.width - 1 - point.x, y: point.y });
    if (mirror.vertical) points.push({ x: point.x, y: sprite.height - 1 - point.y });
    if (mirror.horizontal && mirror.vertical) {
      points.push({ x: sprite.width - 1 - point.x, y: sprite.height - 1 - point.y });
    }

    ctx.save();

    for (const [index, position] of points.entries()) {
      const bounds = brushBounds(position.x, position.y, getSize());
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
