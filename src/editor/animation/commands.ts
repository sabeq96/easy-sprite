import type { CommandRegistry } from "@/commands/types";
import { useAnimationStore } from "./store";

/** Toggling onion skin; it only touches the animation store, so it needs no context. */
export function animationCommands(): CommandRegistry {
  return {
    "view.toggleOnion": {
      id: "view.toggleOnion",
      label: "Toggle onion skin",
      group: "View",
      isActive: () => useAnimationStore.getState().onion.enabled,
      run: () => {
        const { onion, setOnion } = useAnimationStore.getState();
        setOnion({ enabled: !onion.enabled });
      },
    },
  };
}
