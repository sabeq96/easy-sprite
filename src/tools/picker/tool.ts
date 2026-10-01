import { Pipette } from "lucide-react";
import type { Gesture, ToolHost } from "@/framework/host";
import { switchSetting } from "@/framework/settings";
import { defineTool } from "@/framework/tool";

const settings = {
  // Sampling the merged image is what users expect by default.
  pickFromComposite: switchSetting({ label: "Sample merged image", default: true }),
};

function sample(host: ToolHost<typeof settings>, { point, surface, slot }: Gesture): void {
  const { x, y } = point;
  if (x < 0 || y < 0 || x >= surface.width || y >= surface.height) return;

  const color = host.tool.settings().pickFromComposite
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
  settings,
  // Dragging keeps sampling, like Piskel.
  continuous: true,

  onPointerDown: sample,
  onPointerMove: sample,
});
