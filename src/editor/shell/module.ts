import { defineModule } from "@/editor/module";
import { SHELL_COMMANDS } from "./commands";

export const shellModule = defineModule({
  id: "shell",
  commands: SHELL_COMMANDS,
});
