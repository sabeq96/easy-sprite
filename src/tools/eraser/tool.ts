import { Eraser } from "lucide-react";
import type { ToolHost } from "@/framework/host";
import { defineTool } from "@/framework/tool";
import { TRANSPARENT } from "@/lib/color";
import { brushSize, createBrushPreview } from "@/tools/shared/brush";
import { stamp, stampLine } from "@/tools/shared/paint";

const settings = { size: brushSize() };

type EraserHost = ToolHost<typeof settings>;

// The eraser declares no mirror, so its preview can never draw a mirrored copy.
const preview = createBrushPreview((host: EraserHost) => host.tool.settings());

// `replace: true` — erasing must zero the pixel, not blend transparency over it.
const eraseOptions = (host: EraserHost) => ({
  color: TRANSPARENT,
  size: host.tool.settings().size,
  replace: true,
});

export const eraserTool = defineTool({
  id: "eraser",
  label: "Eraser",
  icon: Eraser,
  group: "draw",
  shortcut: { key: "e" },
  continuous: true,
  settings,
  reselect: "size",

  onActivate: (host) => preview.activate(host),

  onHover(_host, point) {
    preview.move(point);
    return null;
  },

  onPointerDown(host, { surface, point }) {
    preview.move(point);
    surface.commit(stamp(surface, point, eraseOptions(host)));
  },

  onPointerMove(host, { surface, previous, point }) {
    preview.move(point);
    surface.commit(stampLine(surface, previous, point, eraseOptions(host)));
  },
});
