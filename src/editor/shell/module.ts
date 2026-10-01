import type { EditorModule } from "@/editor/module";
import { shellCommands } from "./commands";

export const shellModule: EditorModule = {
  id: "shell",
  commands: shellCommands,
};
