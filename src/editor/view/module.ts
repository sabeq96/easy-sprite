import type { EditorModule } from "@/editor/module";
import { attachGrid } from "./attachCanvas";
import { viewCommands } from "./commands";

export const viewModule: EditorModule = {
  id: "view",
  commands: viewCommands,
  attachCanvas: attachGrid,
};
