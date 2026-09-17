import type { StampOptions } from "@/editor/tools/paint";
import { commitWrite, stamp, stampLine } from "@/editor/tools/paint";
import type { Tool, ToolContext } from "@/editor/tools/types";

function stampOptions(ctx: ToolContext): StampOptions {
  return {
    color: ctx.color,
    size: ctx.options.brushSize,
    mirrorHorizontal: ctx.options.mirrorHorizontal,
    mirrorVertical: ctx.options.mirrorVertical,
  };
}

export const pencilTool: Tool = {
  id: "pencil",
  label: "Pencil",
  continuous: true,

  onPointerDown(ctx, point) {
    ctx.stroke.touch(ctx.layerId, ctx.frameId);
    commitWrite(ctx, stamp(ctx, point, stampOptions(ctx)));
  },

  onPointerMove(ctx, point, previous) {
    commitWrite(ctx, stampLine(ctx, previous, point, stampOptions(ctx)));
  },
};
