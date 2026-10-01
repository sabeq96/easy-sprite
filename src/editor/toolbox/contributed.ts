import type { CommandRegistry } from "@/commands/types";
import type { ModuleContext } from "@/editor/module";
import type { ContributedCommand } from "@/framework/command";
import type { ToolHost } from "@/framework/host";
import type { Settings } from "@/framework/settings";
import type { Tool } from "@/framework/tool";
import {
  TOOL_LIST,
  type ContributedCommandId,
  type SettingCommandId,
  type ToolId,
} from "@/tools";
import { useToolboxStore } from "./store";

const TOOLS_WITH_COMMANDS: readonly Tool<ToolId>[] = TOOL_LIST;

/**
 * The commands a tool's settings declare: one per boolean setting with a `command`. It flips the
 * value, shows it as its active state, and is enabled only while that tool is active.
 */
function settingCommands(toolId: ToolId, settings: Settings | undefined): ContributedCommand[] {
  return Object.entries(settings ?? {}).flatMap(([key, setting]) => {
    if (setting.kind === "choice" || !setting.command) return [];
    const { id, label, keys } = setting.command;
    const value = (host: ToolHost) => host.tool.settings()[key] === true;
    return [
      {
        id,
        label: label ?? setting.label,
        group: "Tools",
        keys,
        isEnabled: () => useToolboxStore.getState().toolId === toolId,
        isActive: value,
        run: (host: ToolHost) => host.tool.set(key, !value(host)),
      },
    ];
  });
}

/** Each tool with the commands it contributes and those its settings declare, in registry order. */
const CONTRIBUTIONS = TOOLS_WITH_COMMANDS.flatMap((tool) =>
  [...(tool.commands ?? []), ...settingCommands(tool.id, tool.settings)].map((command) => ({
    toolId: tool.id,
    command,
  })),
);

type ContributionId = ContributedCommandId | SettingCommandId;

const idOf = (command: ContributedCommand) => command.id as ContributionId;

/** Every tool-contributed command as a registry entry, bound to its tool's view of the host. */
export function createContributedCommands(host: Pick<ModuleContext, "forTool">): CommandRegistry {
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
