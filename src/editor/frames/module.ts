import { defineModule } from "@/editor/module";
import { FRAME_COMMANDS } from "./commands";
import { useFramesStore } from "./store";

export const framesModule = defineModule({
  id: "frames",
  commands: FRAME_COMMANDS,
  subscribe: useFramesStore.subscribe,
});
