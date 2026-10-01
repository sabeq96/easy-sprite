import { defineModule } from "@/editor/module";
import { attachGrid } from "./attachCanvas";
import { VIEW_COMMANDS } from "./commands";
import { useViewStore } from "./store";

export const viewModule = defineModule({
  id: "view",
  commands: VIEW_COMMANDS,
  attachCanvas: attachGrid,
  subscribe: useViewStore.subscribe,
});
