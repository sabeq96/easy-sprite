import { PaintRoller, Shapes } from "lucide-react";
import { constrain, forEachShapePixel } from "./shapes";
import { writePixel } from "@/tools/shared/paint";
import type { Gesture, ToolHost } from "@/framework/host";
import { choice, toggle } from "@/framework/settings";
import { defineTool, type ToolPoint } from "@/framework/tool";
import { rectUnion, type Rect } from "@/lib/rect";

const settings = {
  shape: choice({
    label: "Shape",
    values: ["rectangle", "ellipse", "line"],
    default: "rectangle",
    labels: { rectangle: "Rectangle", ellipse: "Ellipse", line: "Line" },
  }),
  fill: toggle({
    label: "Fill",
    icon: PaintRoller,
    default: false,
    command: { id: "tool.toggleFill", keys: [{ key: "f" }] },
  }),
};

type ShapeHost = ToolHost<typeof settings>;

/** Where the current drag was pressed; every gesture sets it on pointer down. */
let origin: ToolPoint = { x: 0, y: 0 };

/** Draws the whole shape from `origin` to the gesture's point, in the gesture's color. */
function draw(host: ShapeHost, { surface, point, modifiers, slot }: Gesture): void {
  const { shape, fill } = host.tool.settings();
  const end = modifiers.shift ? constrain(shape, origin, point) : point;
  const color = host.colors.get(slot);

  let dirty: Rect | null = null;
  forEachShapePixel(shape, origin, end, fill, (x, y) => {
    if (writePixel(surface, x, y, color, false)) dirty = rectUnion(dirty, { x, y, w: 1, h: 1 });
  });
  surface.commit(dirty);
}

export const shapeTool = defineTool({
  id: "shape",
  label: "Shape",
  icon: Shapes,
  group: "draw",
  shortcut: { key: "r" },
  continuous: true,
  settings,
  reselect: "shape",
  hints: [{ action: "Square, circle or 8-direction line", inputs: [{ hold: "shift" }, { pointer: "drag" }] }],

  onPointerDown(host, gesture) {
    origin = gesture.point;
    draw(host, gesture);
  },

  // Redraw from scratch, so shrinking the drag leaves nothing of the earlier preview behind.
  onPointerMove(host, gesture) {
    gesture.surface.revert();
    draw(host, gesture);
  },
});
