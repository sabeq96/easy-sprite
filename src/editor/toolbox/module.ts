import type { EditorModule } from "@/editor/module";
import { createContributedCommands } from "./contributed";
import { useToolboxStore } from "./store";
import { createToolCommands } from "./toolCommands";

export const toolboxModule: EditorModule = {
  id: "toolbox",
  // One command per tool, then the commands tools contribute (the selection's copy, cut, paste, …)
  // and those their settings declare (the mirror toggle). Handlers read the store when they run.
  commands: (ctx) => ({ ...createToolCommands(), ...createContributedCommands(ctx) }),
  subscribe: useToolboxStore.subscribe,
};
