import type { CommandId, ToolCommandId } from "@/commands/types";
import { APP_SHORTCUTS } from "@/constants/shortcuts";
import { TOOL_LIST, type ToolId } from "@/editor/tools";
import type { Tool } from "@/editor/tools/types";
import { formatBinding, type KeyBinding } from "@/lib/keys";

const TOOL_SHORTCUTS = Object.fromEntries(
  TOOL_LIST.flatMap((tool) => (tool.shortcut ? [[`tool.${tool.id}`, [tool.shortcut]]] : [])),
) as Partial<Record<ToolCommandId, KeyBinding[]>>;

/**
 * The merged keymap: app keys plus each tool's own. The handler, tooltips and the shortcut
 * sheet all read this one table. No two entries may share a chord; a unit test enforces it.
 */
export const SHORTCUTS: Partial<Record<CommandId, KeyBinding[]>> = {
  ...TOOL_SHORTCUTS,
  ...APP_SHORTCUTS,
};

/** Every bound chord for a command, formatted for display. Empty when it has none. */
export function commandKeys(commandId: CommandId): string[] {
  return (SHORTCUTS[commandId] ?? []).map(formatBinding);
}

/** "P again": the key that runs a tool's `reselectCommand`. Empty when it has none. */
export function reselectKeys(tool: Tool<ToolId>): string[] {
  if (!tool.reselectCommand) return [];
  return commandKeys(`tool.${tool.id}`).map((key) => `${key} again`);
}
