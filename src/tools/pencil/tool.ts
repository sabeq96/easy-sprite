import { Brush } from "lucide-react";
import type { StampOptions } from "@/tools/shared/paint";
import { stamp, stampLine } from "@/tools/shared/paint";
import type { Gesture, ToolHost } from "@/framework/host";
import { defineTool } from "@/framework/tool";

function brush(host: ToolHost, gesture: Gesture): StampOptions {
  const options = host.tool.options();
  return {
    color: host.colors.get(gesture.slot),
    size: options.brushSize,
    mirrorHorizontal: options.mirrorHorizontal,
    mirrorVertical: options.mirrorVertical,
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

  onPointerDown(host, gesture) {
    gesture.surface.commit(stamp(gesture.surface, gesture.point, brush(host, gesture)));
  },

  onPointerMove(host, gesture) {
    const { surface, previous, point } = gesture;
    surface.commit(stampLine(surface, previous, point, brush(host, gesture)));
  },
});
