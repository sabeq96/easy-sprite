import type { OverlayPainter } from "@/editor/renderer";
import type { LiftedRegion, Selection } from "@/editor/selection";
import type { Rect } from "@/lib/rect";

const DASH = [4, 4];

/** Marching ants: two offset dashed strokes so it reads against any artwork. */
export function marchingAntsPainter(
  getSelection: () => Selection | null,
  getPending: () => Rect | null,
): OverlayPainter {
  return (ctx, viewport) => {
    const rect = getPending() ?? getSelection()?.rect ?? null;
    if (!rect) return;

    const x = Math.round(viewport.originX + rect.x * viewport.scale) + 0.5;
    const y = Math.round(viewport.originY + rect.y * viewport.scale) + 0.5;
    const width = rect.w * viewport.scale;
    const height = rect.h * viewport.scale;
    // Animates via the renderer's rAF loop rather than a second timer.
    const phase = (performance.now() / 60) % 8;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash(DASH);

    ctx.strokeStyle = "#000";
    ctx.lineDashOffset = -phase;
    ctx.strokeRect(x, y, width, height);

    ctx.strokeStyle = "#fff";
    ctx.lineDashOffset = -phase + 4;
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  };
}

export interface FloatingState {
  region: LiftedRegion;
  offset: { x: number; y: number };
}

export function floatingPainter(get: () => FloatingState | null): OverlayPainter {
  return (ctx, viewport) => {
    const state = get();
    if (!state) return;

    const { region, offset } = state;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      region.canvas,
      viewport.originX + (region.rect.x + offset.x) * viewport.scale,
      viewport.originY + (region.rect.y + offset.y) * viewport.scale,
      region.rect.w * viewport.scale,
      region.rect.h * viewport.scale,
    );
    ctx.restore();

    const x = Math.round(viewport.originX + (region.rect.x + offset.x) * viewport.scale) + 0.5;
    const y = Math.round(viewport.originY + (region.rect.y + offset.y) * viewport.scale) + 0.5;
    ctx.save();
    ctx.setLineDash(DASH);
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(x, y, region.rect.w * viewport.scale, region.rect.h * viewport.scale);
    ctx.restore();
  };
}
