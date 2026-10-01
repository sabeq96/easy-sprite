import { defineModule } from "@/editor/module";
import { attachOnion } from "./attachCanvas";
import { ANIMATION_COMMANDS } from "./commands";
import { useAnimationStore } from "./store";

export const animationModule = defineModule({
  id: "animation",
  commands: ANIMATION_COMMANDS,
  attachCanvas: attachOnion,
  subscribe: useAnimationStore.subscribe,
});
