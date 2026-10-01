import type { EditorModule } from "@/editor/module";
import { layerCommands } from "./commands";

export const layersModule: EditorModule = {
  id: "layers",
  commands: layerCommands,
};
