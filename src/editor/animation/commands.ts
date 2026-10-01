import { defineCommands } from "@/editor/module";
import { useAnimationStore } from "./store";

/** Toggling onion skin; it only touches the animation store. */
export const ANIMATION_COMMANDS = defineCommands([
  {
    id: "view.toggleOnion",
    label: "Toggle onion skin",
    group: "View",
    keys: [{ key: "o", mod: true, shift: true }],
    isActive: () => useAnimationStore.getState().onion.enabled,
    run: () => {
      const { onion, setOnion } = useAnimationStore.getState();
      setOnion({ enabled: !onion.enabled });
    },
  },
]);
