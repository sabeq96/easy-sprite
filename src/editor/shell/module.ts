import type { EditorModule } from "@/editor/module";
import { CANVAS_VIEW_HINTS } from "@/hooks/useCanvasViewControls";
import { COLOR_HOTKEY_HINTS } from "@/hooks/useColorHotkeys";
import { POINTER_PAINT_HINTS } from "@/hooks/usePointerPaint";
import { shellCommands } from "./commands";

export const shellModule: EditorModule = {
  id: "shell",
  commands: shellCommands,
  // Held here only until their owners become modules: palette takes the colour keys, canvas the rest.
  hints: [COLOR_HOTKEY_HINTS, POINTER_PAINT_HINTS, CANVAS_VIEW_HINTS],
};
