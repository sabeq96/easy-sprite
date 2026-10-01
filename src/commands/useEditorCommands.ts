import { createContributedCommands } from "@/commands/contributed";
import { createToolCommands } from "@/commands/toolCommands";
import type { CommandRegistry } from "@/commands/types";
import { useToolHost } from "@/hooks/toolHost/ToolHostContext";
import { useEditorStore } from "@/stores/useEditorStore";

/**
 * The commands not yet moved into a host module (`EDITOR_MODULES`); the shell merges both.
 * Every surface — toolbar, menus, keymap, cheat sheet — reads the merged registry, so they
 * cannot drift apart.
 */
export function useEditorCommands(): CommandRegistry {
  const toolHost = useToolHost();

  return {
    // Handlers read the store via getState(), so the registry does not churn every render.
    ...createToolCommands(useEditorStore),
    // The selection's copy, cut, paste, … are the select tool's own (see `Tool.commands`).
    ...createContributedCommands(toolHost),
  };
}
