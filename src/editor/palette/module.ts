import { defineModule } from "@/editor/module";
import { PALETTE_COMMANDS } from "./commands";
import { usePaletteStore } from "./store";
import { COLOR_HOTKEY_HINTS } from "./useColorHotkeys";

export const paletteModule = defineModule({
  id: "palette",
  commands: PALETTE_COMMANDS,
  hints: [COLOR_HOTKEY_HINTS],
  subscribe: usePaletteStore.subscribe,
});
