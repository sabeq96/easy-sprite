import { defineModule } from "@/editor/module";
import { LAYER_COMMANDS } from "./commands";
import { useLayersStore } from "./store";

export const layersModule = defineModule({
  id: "layers",
  commands: LAYER_COMMANDS,
  subscribe: useLayersStore.subscribe,
});
