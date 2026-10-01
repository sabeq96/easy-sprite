import type { EditorModule } from "@/editor/module";
import { paletteCommands } from "./commands";
import { COLOR_HOTKEY_HINTS } from "./useColorHotkeys";

export const paletteModule: EditorModule = {
  id: "palette",
  commands: paletteCommands,
  hints: [COLOR_HOTKEY_HINTS],
};
