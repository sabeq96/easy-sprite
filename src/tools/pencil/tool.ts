import { Brush } from "lucide-react";
import type { StampOptions } from "@/tools/shared/paint";
import { commitWrite, stamp, stampLine } from "@/tools/shared/paint";
import { defineTool, type ToolContext } from "@/framework/tool";

function stampOptions(ctx: ToolContext): StampOptions {
  return {
    color: ctx.color,
    size: ctx.options.brushSize,
    mirrorHorizontal: ctx.options.mirrorHorizontal,
    mirrorVertical: ctx.options.mirrorVertical,
  };
}

export const pencilTool = defineTool({
  id: "pencil",
  label: "Pencil",
  icon: Brush,
  group: "draw",
  shortcut: { key: "p" },
  reselectCommand: "tool.cycleBrushSize",
  continuous: true,
  options: ["brushSize", "mirror"],

  onPointerDown(ctx, point) {
    ctx.stroke.touch(ctx.layerId, ctx.frameId);
    commitWrite(ctx, stamp(ctx, point, stampOptions(ctx)));
  },

  onPointerMove(ctx, point, previous) {
    commitWrite(ctx, stampLine(ctx, previous, point, stampOptions(ctx)));
  },
});
