import { SESSION_COMMANDS } from "@/commands/session";
import { defineModule } from "@/editor/module";

export const shellModule = defineModule({
  id: "shell",
  commands: SESSION_COMMANDS,
});
