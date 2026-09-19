import { floodFill } from "@/editor/pixels";
import { commitWrite } from "@/editor/tools/paint";
import type { Tool } from "@/editor/tools/types";

function createFill(id: "bucket" | "fillSimilar", label: string, contiguous: boolean): Tool {
  return {
    id,
    label,
    // A drag must not repeat the fill.
    continuous: false,
    options: [],

    onPointerDown(ctx, point) {
      ctx.stroke.touch(ctx.layerId, ctx.frameId);
      const cel = ctx.doc.ensureCel(ctx.layerId, ctx.frameId);

      const dirty = floodFill(
        { buffer: cel.pixels, width: ctx.doc.width, height: ctx.doc.height },
        point.x,
        point.y,
        ctx.color,
        { contiguous, mask: ctx.mask },
      );

      commitWrite(ctx, dirty);
    },
  };
}

export const bucketTool = createFill("bucket", "Paint bucket", true);
export const fillSimilarTool = createFill("fillSimilar", "Fill similar", false);
