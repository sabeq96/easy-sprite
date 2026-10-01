import type { EditorModule } from "@/editor/module";
import { frameCommands } from "./commands";
import { useFramesStore } from "./store";

export const framesModule: EditorModule = {
  id: "frames",
  commands: frameCommands,
  subscribe: useFramesStore.subscribe,
};
