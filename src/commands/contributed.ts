import type { CommandRegistry } from "@/commands/types";
import type { ContributedCommand } from "@/framework/command";
import type { Tool } from "@/framework/tool";
import type { DocumentToolHost } from "@/hooks/toolHost/createToolHost";
import type { KeyBinding } from "@/lib/keys";
import { TOOL_LIST, type ContributedCommandId, type ToolId } from "@/tools";

const TOOLS_WITH_COMMANDS: readonly Tool<ToolId>[] = TOOL_LIST;

/** Each tool with the commands it contributes, in registry order. */
const CONTRIBUTIONS = TOOLS_WITH_COMMANDS.flatMap((tool) =>
  (tool.commands ?? []).map((command) => ({ toolId: tool.id, command })),
);

const idOf = (command: ContributedCommand) => command.id as ContributedCommandId;

/** The keys tools declare for their own commands; `@/commands/keymap` merges them. */
export const CONTRIBUTED_SHORTCUTS = Object.fromEntries(
  CONTRIBUTIONS.flatMap(({ command }) =>
    command.keys ? [[idOf(command), [...command.keys]]] : [],
  ),
) as Partial<Record<ContributedCommandId, KeyBinding[]>>;

/** Every tool-contributed command as a registry entry, bound to its tool's view of the host. */
export function createContributedCommands(host: DocumentToolHost): CommandRegistry {
  const registry: CommandRegistry = {};
  for (const { toolId, command } of CONTRIBUTIONS) {
    const toolHost = host.forTool(toolId);
    const { isEnabled, isActive } = command;
    registry[idOf(command)] = {
      id: idOf(command),
      label: command.label,
      group: command.group,
      isEnabled: isEnabled ? () => isEnabled(toolHost) : undefined,
      isActive: isActive ? () => isActive(toolHost) : undefined,
      run: () => command.run(toolHost),
    };
  }
  return registry;
}
