import { getPixel } from "@/editor/buffer";
import { compositeFrame } from "@/editor/composite";
import type { Tool, ToolContext, ToolPoint } from "@/editor/tools/types";

function sample(ctx: ToolContext, point: ToolPoint): void {
  const { doc } = ctx;
  if (point.x < 0 || point.y < 0 || point.x >= doc.width || point.y >= doc.height) return;

  if (!ctx.options.pickFromComposite) {
    const cel = doc.getCel(ctx.layerId, ctx.frameId);
    if (cel) ctx.setColor(getPixel(cel.pixels, point.x, point.y, doc.width));
    return;
  }

  // Sampling the merged image is what users expect by default.
  const canvas = compositeFrame(doc, ctx.frameId);
  const data = canvas.getContext("2d")?.getImageData(point.x, point.y, 1, 1).data;
  if (data) ctx.setColor({ r: data[0], g: data[1], b: data[2], a: data[3] });
}

export const pickerTool: Tool = {
  id: "picker",
  label: "Color picker",
  // Dragging keeps sampling, like Piskel.
  continuous: true,

  onPointerDown(ctx, point) {
    sample(ctx, point);
  },

  onPointerMove(ctx, point) {
    sample(ctx, point);
  },
};
