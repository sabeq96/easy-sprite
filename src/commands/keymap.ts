import type { CommandId, ToolCommandId } from "@/commands/types";
import { APP_SHORTCUTS } from "@/constants/shortcuts";
import {
  TOOL_LIST,
  type ContributedCommandId,
  type SettingCommandId,
  type ToolId,
} from "@/tools";
import type { Tool } from "@/framework/tool";
import { formatBinding, type KeyBinding } from "@/lib/keys";

const TOOL_SHORTCUTS = Object.fromEntries(
  TOOL_LIST.flatMap((tool) => (tool.shortcut ? [[`tool.${tool.id}`, [tool.shortcut]]] : [])),
) as Partial<Record<ToolCommandId, KeyBinding[]>>;

const TOOLS_WITH_COMMANDS: readonly Tool<ToolId>[] = TOOL_LIST;

/** What each tool declares a command for: its own commands, then its settings', in registry order. */
const DECLARED_COMMANDS = TOOLS_WITH_COMMANDS.flatMap((tool) => [
  ...(tool.commands ?? []),
  ...Object.values(tool.settings ?? {}).flatMap((setting) =>
    setting.kind !== "choice" && setting.command ? [setting.command] : [],
  ),
]);

/** The keys tools declare for those commands; the toolbox module registers the commands. */
const CONTRIBUTED_SHORTCUTS = Object.fromEntries(
  DECLARED_COMMANDS.flatMap(({ id, keys }) => (keys ? [[id, [...keys]]] : [])),
) as Partial<Record<ContributedCommandId | SettingCommandId, KeyBinding[]>>;

/**
 * The merged keymap: app keys, each tool's own key, and the keys of the commands tools
 * contribute. The handler, tooltips and the shortcut sheet all read this one table. No two
 * entries may share a chord; a unit test enforces it.
 */
export const SHORTCUTS: Partial<Record<CommandId, KeyBinding[]>> = {
  ...TOOL_SHORTCUTS,
  ...CONTRIBUTED_SHORTCUTS,
  ...APP_SHORTCUTS,
};

/** Every bound chord for a command, formatted for display. Empty when it has none. */
export function commandKeys(commandId: CommandId): string[] {
  return (SHORTCUTS[commandId] ?? []).map(formatBinding);
}

/** "P again": the key that steps a tool's `reselect` setting. Empty when it has none. */
export function reselectKeys(tool: Tool<ToolId>): string[] {
  if (!tool.reselect) return [];
  return commandKeys(`tool.${tool.id}`).map((key) => `${key} again`);
}
