import { Pipette } from "lucide-react";
import type { Gesture, ToolHost } from "@/framework/host";
import { defineTool } from "@/framework/tool";

function sample(host: ToolHost, { point, surface, slot }: Gesture): void {
  const { x, y } = point;
  if (x < 0 || y < 0 || x >= surface.width || y >= surface.height) return;

  // Sampling the merged image is what users expect by default.
  const color = host.tool.options().pickFromComposite
    ? host.document.sampleComposite(x, y)
    : surface.read(x, y);
  if (color) host.colors.set(slot, color);
}

export const pickerTool = defineTool({
  id: "picker",
  label: "Color picker",
  icon: Pipette,
  group: "color",
  shortcut: { key: "o" },
  options: ["pickSource"],
  // Dragging keeps sampling, like Piskel.
  continuous: true,

  onPointerDown: sample,
  onPointerMove: sample,
});
