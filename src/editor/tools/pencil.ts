import type { StampOptions } from "@/editor/tools/paint";
import { commitWrite, stamp, stampLine } from "@/editor/tools/paint";
import type { Tool, ToolContext } from "@/editor/tools/types";

function stampOptions(ctx: ToolContext, forceMirror: boolean): StampOptions {
  return {
    color: ctx.color,
    size: ctx.options.brushSize,
    mirrorHorizontal: forceMirror || ctx.options.mirrorHorizontal,
    mirrorVertical: !forceMirror && ctx.options.mirrorVertical,
  };
}

function createPencil(
  id: "pencil" | "mirrorPencil",
  label: string,
  forceMirror: boolean,
): Tool {
  return {
    id,
    label,
    cursor: "crosshair",
    continuous: true,

    onPointerDown(ctx, point) {
      ctx.stroke.touch(ctx.layerId, ctx.frameId);
      commitWrite(ctx, stamp(ctx, point, stampOptions(ctx, forceMirror)));
    },

    onPointerMove(ctx, point, previous) {
      commitWrite(ctx, stampLine(ctx, previous, point, stampOptions(ctx, forceMirror)));
    },
  };
}

export const pencilTool = createPencil("pencil", "Pencil", false);
export const mirrorPencilTool = createPencil("mirrorPencil", "Mirror pencil", true);
