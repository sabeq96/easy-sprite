import type { EditorModule } from "@/editor/module";
import { attachOnion } from "./attachCanvas";
import { animationCommands } from "./commands";
import { useAnimationStore } from "./store";

export const animationModule: EditorModule = {
  id: "animation",
  commands: animationCommands,
  attachCanvas: attachOnion,
  subscribe: useAnimationStore.subscribe,
};
