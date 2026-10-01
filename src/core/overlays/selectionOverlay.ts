import type { OverlayPainter } from "@/editor/renderer";
import type { LiftedRegion } from "@/editor/selection";
import type { ToolPoint } from "@/editor/tools/types";
import type { Rect } from "@/lib/rect";

// Same flat-fill language as the brush preview (brushCursor.ts), in blue.
const SELECTION_FILL = "rgba(59,130,246,0.35)";
const HOVER_FILL = "rgba(59,130,246,0.2)";

export interface SelectionView {
  /** Already clamped to the sprite. */
  rect: Rect | null;
  /** Pixels being dragged, drawn at `region.rect + offset`. */
  floating: { region: LiftedRegion; offset: { x: number; y: number } } | null;
  /** In-sprite pixel under the pointer, only when it is not over the selection. */
  hover: ToolPoint | null;
}

/** Draws whatever the select tool resolved — the painter itself holds no logic. */
export function selectionPainter(getView: () => SelectionView | null): OverlayPainter {
  return (ctx, viewport) => {
    const view = getView();
    if (!view) return;

    const fill = (rect: Rect, style: string) => {
      ctx.fillStyle = style;
      ctx.fillRect(
        viewport.originX + rect.x * viewport.scale,
        viewport.originY + rect.y * viewport.scale,
        rect.w * viewport.scale,
        rect.h * viewport.scale,
      );
    };

    ctx.save();
    if (view.floating) {
      const { region, offset } = view.floating;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        region.canvas,
        viewport.originX + (region.rect.x + offset.x) * viewport.scale,
        viewport.originY + (region.rect.y + offset.y) * viewport.scale,
        region.rect.w * viewport.scale,
        region.rect.h * viewport.scale,
      );
    }
    if (view.rect) fill(view.rect, SELECTION_FILL);
    if (view.hover) fill({ ...view.hover, w: 1, h: 1 }, HOVER_FILL);
    ctx.restore();
  };
}
