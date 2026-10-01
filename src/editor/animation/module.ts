import type { EditorModule } from "@/editor/module";
import { attachOnion } from "./attachCanvas";
import { animationCommands } from "./commands";

export const animationModule: EditorModule = {
  id: "animation",
  commands: animationCommands,
  attachCanvas: attachOnion,
};
