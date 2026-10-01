import type { EditorModule } from "@/editor/module";
import { CANVAS_VIEW_HINTS } from "./useCanvasViewControls";
import { POINTER_PAINT_HINTS } from "./usePointerPaint";

export const canvasModule: EditorModule = {
  id: "canvas",
  // No commands and no `subscribe`: the cursor store changes on every pointer move, and no
  // command reads it.
  hints: [POINTER_PAINT_HINTS, CANVAS_VIEW_HINTS],
};
