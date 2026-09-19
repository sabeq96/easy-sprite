import { BUILDER_GRID_SIZE } from "@/constants/builder";
import type { SpriteDocument } from "@/editor/document";
import type { SpritesheetBlockRecord } from "@/db/schema";
import { rectsIntersect, type Rect } from "@/lib/rect";

/** A block's footprint: its sprite's frames laid out as one horizontal strip. */
export function blockRect(block: SpritesheetBlockRecord, doc: SpriteDocument): Rect {
  return { x: block.x, y: block.y, w: doc.width * doc.frames.length, h: doc.height };
}

export function computeBuilderBounds(
  blocks: SpritesheetBlockRecord[],
  docs: Map<string, SpriteDocument>,
): { width: number; height: number } {
  let width = 0;
  let height = 0;

  for (const block of blocks) {
    const doc = docs.get(block.spriteId);
    if (!doc) continue;
    const rect = blockRect(block, doc);
    width = Math.max(width, rect.x + rect.w);
    height = Math.max(height, rect.y + rect.h);
  }

  return { width, height };
}

/**
 * Shelf placement for a newly-added block: try positions left-to-right along the current
 * bottom edge, falling back to directly below everything if nothing fits. Doesn't need to be
 * optimal — it's only a starting point the user can drag from.
 */
export function findFreePosition(
  existing: Rect[],
  size: { w: number; h: number },
  gridSize: number = BUILDER_GRID_SIZE,
): { x: number; y: number } {
  const maxX = Math.max(0, ...existing.map((rect) => rect.x + rect.w));
  const maxY = Math.max(0, ...existing.map((rect) => rect.y + rect.h));

  for (let y = 0; y <= maxY; y += gridSize) {
    for (let x = 0; x <= maxX; x += gridSize) {
      const candidate: Rect = { x, y, w: size.w, h: size.h };
      if (!existing.some((rect) => rectsIntersect(candidate, rect))) return { x, y };
    }
  }

  return { x: 0, y: maxY > 0 ? Math.ceil(maxY / gridSize) * gridSize : 0 };
}
