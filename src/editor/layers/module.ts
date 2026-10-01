import type { EditorModule } from "@/editor/module";
import { layerCommands } from "./commands";
import { useLayersStore } from "./store";

export const layersModule: EditorModule = {
  id: "layers",
  commands: layerCommands,
  subscribe: useLayersStore.subscribe,
};
