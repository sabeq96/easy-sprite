import type { EditorModule } from "@/editor/module";
import { CANVAS_VIEW_HINTS } from "@/hooks/useCanvasViewControls";
import { POINTER_PAINT_HINTS } from "@/hooks/usePointerPaint";
import { shellCommands } from "./commands";

export const shellModule: EditorModule = {
  id: "shell",
  commands: shellCommands,
  // Held here only until canvas becomes a module and takes them.
  hints: [POINTER_PAINT_HINTS, CANVAS_VIEW_HINTS],
};
