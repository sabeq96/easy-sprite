import type { CommandId, ToolCommandId } from "@/commands/types";
import { APP_SHORTCUTS } from "@/constants/shortcuts";
import { TOOL_LIST, type ToolId } from "@/editor/tools";
import type { Tool } from "@/editor/tools/types";
import { formatBinding, formatModifier, type HeldModifier, type KeyBinding } from "@/lib/keys";

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

/** Modifiers held to borrow a tool (`Tool.holdKey`), keyed by lowercased `event.key`. */
export const HELD_TOOL_KEYS: Partial<Record<HeldModifier, ToolId>> = Object.fromEntries(
  TOOL_LIST.flatMap((tool) => (tool.holdKey ? [[tool.holdKey, tool.id]] : [])),
);

/** Every bound chord for a command, formatted for display. Empty when it has none. */
export function commandKeys(commandId: CommandId): string[] {
  return (SHORTCUTS[commandId] ?? []).map(formatBinding);
}

/** A tool's keys for display: the one that selects it, then the one held to borrow it. */
export function toolKeys(tool: Tool<ToolId>): string[] {
  const held = tool.holdKey ? [`Hold ${formatModifier(tool.holdKey)}`] : [];
  return [...commandKeys(`tool.${tool.id}`), ...held];
}
