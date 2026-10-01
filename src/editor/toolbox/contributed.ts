import type { ModuleCommand } from "@/editor/module";
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

type ContributionId = ContributedCommandId | SettingCommandId;

/** One contributed command as a module command, run through its tool's view of the host. */
function contribution(toolId: ToolId, command: ContributedCommand): ModuleCommand<ContributionId> {
  const { isEnabled, isActive } = command;
  return {
    id: command.id as ContributionId,
    label: command.label,
    group: command.group,
    keys: command.keys,
    isEnabled: isEnabled && ((ctx) => isEnabled(ctx.forTool(toolId))),
    isActive: isActive && ((ctx) => isActive(ctx.forTool(toolId))),
    run: (ctx) => command.run(ctx.forTool(toolId)),
  };
}

/**
 * Each tool's contributed commands, then those its settings declare, in tool order. The shell
 * binds them to the open document, so each runs through the document's own tool host.
 */
export const CONTRIBUTED_COMMANDS: readonly ModuleCommand<ContributionId>[] =
  TOOLS_WITH_COMMANDS.flatMap((tool) =>
    [...(tool.commands ?? []), ...settingCommands(tool.id, tool.settings)].map((command) =>
      contribution(tool.id, command),
    ),
  );
