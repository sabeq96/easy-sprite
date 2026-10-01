import type { Colors } from "@/framework/host";
import { usePaletteStore } from "./store";

/** `ToolHost.colors`: the primary and secondary colors a tool paints and picks with. */
export function createColorsAdapter(): Colors {
  return {
    get: (slot) => {
      const state = usePaletteStore.getState();
      return slot === "secondary" ? state.secondaryColor : state.primaryColor;
    },
    set: (slot, color) => {
      const state = usePaletteStore.getState();
      if (slot === "secondary") state.setSecondaryColor(color);
      else state.setPrimaryColor(color);
    },
  };
}
