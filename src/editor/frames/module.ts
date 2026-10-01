import type { EditorModule } from "@/editor/module";
import { frameCommands } from "./commands";

export const framesModule: EditorModule = {
  id: "frames",
  commands: frameCommands,
};
