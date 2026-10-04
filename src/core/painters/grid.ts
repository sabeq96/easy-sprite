import { GRID_LINE_WIDTH, GRID_MIN_SCALE, MAX_GRID_SIZE } from "@/constants/canvas";
import { snapTileSize, tileSizeOptions } from "@/core/grid";
import type { PaintContext } from "@/core/renderer";

/** The grid, one cell per `size` sprite pixels (snapped to a size that tiles evenly). */
export function drawGrid(p: PaintContext, size: number): void {
  const { ctx, doc, dpr } = p;
  const { scale, originX, originY } = p.viewport;
  const options = tileSizeOptions(doc.width, doc.height, MAX_GRID_SIZE);
  const step = snapTileSize(size, options);
  if (scale * step < GRID_MIN_SCALE) return; // a sub-pixel grid is just noise

  const width = doc.width * scale;
  const height = doc.height * scale;
  // Half-pixel offset puts a 1px line on the boundary instead of straddling it.
  const offset = 0.5 / dpr;

  ctx.lineWidth = GRID_LINE_WIDTH;
  ctx.strokeStyle = "rgba(128,128,128,0.35)";
  ctx.beginPath();

  for (let x = 0; x <= doc.width; x += step) {
    const screenX = Math.round(originX + x * scale) + offset;
    ctx.moveTo(screenX, originY);
    ctx.lineTo(screenX, originY + height);
  }
  for (let y = 0; y <= doc.height; y += step) {
    const screenY = Math.round(originY + y * scale) + offset;
    ctx.moveTo(originX, screenY);
    ctx.lineTo(originX + width, screenY);
  }

  ctx.stroke();
}
