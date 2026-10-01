import { Brush, FlipHorizontal, FlipVertical } from "lucide-react";
import { brushSize, createBrushPreview } from "@/tools/shared/brush";
import type { StampOptions } from "@/tools/shared/paint";
import { stamp, stampLine } from "@/tools/shared/paint";
import type { Gesture, ToolHost } from "@/framework/host";
import { toggle } from "@/framework/settings";
import { defineTool } from "@/framework/tool";

const settings = {
  size: brushSize(),
  mirrorHorizontal: toggle({
    label: "Mirror horizontally",
    icon: FlipHorizontal,
    group: "Mirror",
    default: false,
    command: { id: "tool.toggleMirror", keys: [{ key: "v" }] },
  }),
  mirrorVertical: toggle({
    label: "Mirror vertically",
    icon: FlipVertical,
    group: "Mirror",
    default: false,
  }),
};

type PencilHost = ToolHost<typeof settings>;

const preview = createBrushPreview((host: PencilHost) => host.tool.settings());

function brush(host: PencilHost, gesture: Gesture): StampOptions {
  return { color: host.colors.get(gesture.slot), ...host.tool.settings() };
}

export const pencilTool = defineTool({
  id: "pencil",
  label: "Pencil",
  icon: Brush,
  group: "draw",
  shortcut: { key: "p" },
  continuous: true,
  settings,
  reselect: "size",

  onActivate: (host) => preview.activate(host),

  onHover(_host, point) {
    preview.move(point);
    return null;
  },

  onPointerDown(host, gesture) {
    preview.move(gesture.point);
    gesture.surface.commit(stamp(gesture.surface, gesture.point, brush(host, gesture)));
  },

  onPointerMove(host, gesture) {
    const { surface, previous, point } = gesture;
    preview.move(point);
    surface.commit(stampLine(surface, previous, point, brush(host, gesture)));
  },
});
