import { defineCommands } from "@/editor/module";
import { usePaletteStore } from "./store";

/** Swapping and resetting the primary and secondary colors. */
export const PALETTE_COMMANDS = defineCommands([
  {
    id: "color.swap",
    label: "Swap colors",
    group: "Color",
    keys: [{ key: "x" }],
    run: () => usePaletteStore.getState().swapColors(),
  },
  {
    id: "color.reset",
    label: "Reset colors",
    group: "Color",
    keys: [{ key: "d" }],
    run: () => usePaletteStore.getState().resetColors(),
  },
]);
