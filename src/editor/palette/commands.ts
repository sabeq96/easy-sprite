import type { CommandRegistry } from "@/commands/types";
import { usePaletteStore } from "./store";

/** Swapping and resetting the primary and secondary colors. */
export function paletteCommands(): CommandRegistry {
  return {
    "color.swap": {
      id: "color.swap",
      label: "Swap colors",
      group: "Color",
      run: () => usePaletteStore.getState().swapColors(),
    },
    "color.reset": {
      id: "color.reset",
      label: "Reset colors",
      group: "Color",
      run: () => usePaletteStore.getState().resetColors(),
    },
  };
}
