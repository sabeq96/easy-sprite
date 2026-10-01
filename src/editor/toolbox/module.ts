import { defineModule } from "@/editor/module";
import { TOOLBOX_COMMANDS } from "./commands";
import { useToolboxStore } from "./store";

export const toolboxModule = defineModule({
  id: "toolbox",
  commands: TOOLBOX_COMMANDS,
  subscribe: useToolboxStore.subscribe,
});
