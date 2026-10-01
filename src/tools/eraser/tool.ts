import { Eraser } from "lucide-react";
import type { ToolHost } from "@/framework/host";
import { TRANSPARENT } from "@/lib/color";
import { stamp, stampLine } from "@/tools/shared/paint";
import { defineTool } from "@/framework/tool";

// `replace: true` — erasing must zero the pixel, not blend transparency over it.
const eraseOptions = (host: ToolHost) => ({
  color: TRANSPARENT,
  size: host.tool.options().brushSize,
  replace: true,
});

export const eraserTool = defineTool({
  id: "eraser",
  label: "Eraser",
  icon: Eraser,
  group: "draw",
  shortcut: { key: "e" },
  reselectCommand: "tool.cycleBrushSize",
  continuous: true,
  options: ["brushSize"],

  onPointerDown(host, { surface, point }) {
    surface.commit(stamp(surface, point, eraseOptions(host)));
  },

  onPointerMove(host, { surface, previous, point }) {
    surface.commit(stampLine(surface, previous, point, eraseOptions(host)));
  },
});
