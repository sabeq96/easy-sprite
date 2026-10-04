import type { CommandDefinition, CommandRegistry } from "@/commands/types";
import type { Tool } from "@/framework/tool";
import { formatBinding, matchesBinding } from "@/lib/keys";
import type { ToolId } from "@/tools";

/*
 * There is no key table: every command declares its own `keys`, so the active registry is the
 * keymap. The handler, tooltips and Keyboard shortcuts all read it. No two commands in one
 * registry may share a chord; a unit test checks each registry.
 */

/** Every chord bound to a command, formatted for display; empty when it has none or is missing. */
export function keysOf(command: CommandDefinition | undefined): string[] {
  return (command?.keys ?? []).map(formatBinding);
}

/** "P again": the key that steps a tool's `reselect` setting, from the registry; empty when none. */
export function reselectKeys(tool: Tool<ToolId>, registry: CommandRegistry): string[] {
  if (!tool.reselect) return [];
  return keysOf(registry[`tool.${tool.id}`]).map((key) => `${key} again`);
}

/** The registered command a key press is bound to, if any. */
export function boundCommand(
  registry: CommandRegistry,
  event: KeyboardEvent,
): CommandDefinition | undefined {
  return Object.values(registry).find((command) =>
    command?.keys?.some((binding) => matchesBinding(event, binding)),
  );
}
