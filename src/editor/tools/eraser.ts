import { TRANSPARENT } from "@/lib/color";
import { commitWrite, stamp, stampLine } from "@/editor/tools/paint";
import { defineTool } from "@/editor/tools/types";

// `replace: true` — erasing must zero the pixel, not blend transparency over it.
const eraseOptions = (size: number) => ({ color: TRANSPARENT, size, replace: true });

export const eraserTool = defineTool({
  id: "eraser",
  label: "Eraser",
  group: "draw",
  shortcut: { key: "e" },
  continuous: true,
  options: ["brushSize"],

  onPointerDown(ctx, point) {
    ctx.stroke.touch(ctx.layerId, ctx.frameId);
    commitWrite(ctx, stamp(ctx, point, eraseOptions(ctx.options.brushSize)));
  },

  onPointerMove(ctx, point, previous) {
    commitWrite(ctx, stampLine(ctx, previous, point, eraseOptions(ctx.options.brushSize)));
  },
});
