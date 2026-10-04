import type { OverlayPaint } from "@/framework/host";
import type { ToolPoint } from "@/framework/tool";
import type { Rect } from "@/lib/rect";
import type { Mask } from "./mask";
import type { FloatingSelection } from "./region";

// Same flat-fill language as the brush preview (brushCursor.ts), in blue.
const SELECTION_RGBA = [59, 130, 246, Math.round(0.35 * 255)];
const HOVER_FILL = "rgba(59,130,246,0.2)";

export interface SelectionView {
  /** Already clamped to the sprite. */
  mask: Mask | null;
  /** Pixels being dragged, drawn at `region.rect + offset`. */
  floating: { region: FloatingSelection; offset: { x: number; y: number } } | null;
  /** In-sprite pixel under the pointer, only when it is not over the selection. */
  hover: ToolPoint | null;
}

const rasters = new WeakMap<Mask, OffscreenCanvas>();

/** One pixel per masked pixel, in the selection fill; rebuilt only when the mask changes. */
function rasterOf(mask: Mask): OffscreenCanvas {
  let raster = rasters.get(mask);
  if (!raster) {
    const { w, h } = mask.rect;
    const data = new ImageData(w, h);
    mask.bits.forEach((bit, i) => {
      if (bit) data.data.set(SELECTION_RGBA, i * 4);
    });
    raster = new OffscreenCanvas(w, h);
    raster.getContext("2d")?.putImageData(data, 0, 0);
    rasters.set(mask, raster);
  }
  return raster;
}

/** Draws whatever the select tool resolved — the painter itself holds no logic. */
export function selectionPainter(getView: () => SelectionView | null): OverlayPaint {
  return ({ ctx, viewport }) => {
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
    if (view.mask) {
      const { rect } = view.mask;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        rasterOf(view.mask),
        viewport.originX + rect.x * viewport.scale,
        viewport.originY + rect.y * viewport.scale,
        rect.w * viewport.scale,
        rect.h * viewport.scale,
      );
    }
    if (view.hover) fill({ ...view.hover, w: 1, h: 1 }, HOVER_FILL);
    ctx.restore();
  };
}
