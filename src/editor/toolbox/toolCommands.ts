import type { Hint } from "@/commands/hints";
import type { CommandHold, CommandRegistry } from "@/commands/types";
import { TOOL_LIST, type ToolId } from "@/tools";
import { nextChoice, resolveSettings, type ChoiceSetting } from "@/framework/settings";
import type { Tool } from "@/framework/tool";
import { useToolboxStore } from "./store";

/** Every tool key springs back when held; the sheet teaches it once rather than on every row. */
export const TOOL_KEY_HOLD_HINT: Hint = {
  action: "Use a tool until you let go",
  inputs: [{ text: "Hold tool key" }],
};

/** One command per tool, generated from the registry so the two cannot drift. */
export function createToolCommands(): CommandRegistry {
  const registry: CommandRegistry = {};

  for (const tool of TOOL_LIST) {
    const commandId = `tool.${tool.id}` as const;
    registry[commandId] = {
      id: commandId,
      label: tool.label,
      group: "Tools",
      isActive: () => useToolboxStore.getState().toolId === tool.id,
      run: () => useToolboxStore.getState().setTool(tool.id),
      hold: toolKeyHold(tool),
    };
  }

  return registry;
}

/** The choice setting a tool's key steps when pressed again (`Tool.reselect`), if any. */
function reselectSetting(tool: Tool<ToolId>): { key: string; setting: ChoiceSetting } | null {
  const key = tool.reselect;
  const setting = key === undefined ? undefined : tool.settings?.[key];
  return key !== undefined && setting?.kind === "choice" ? { key, setting } : null;
}

/** What pressing a tool's key again does, for the cheat sheet; null when it does nothing. */
export function reselectLabel(tool: Tool<ToolId>): string | null {
  const reselect = reselectSetting(tool);
  return reselect && `Cycle ${reselect.setting.label.toLowerCase()}`;
}

/** Steps the tool's reselect choice to its next value, wrapping. */
function stepReselect(tool: Tool<ToolId>): void {
  const reselect = reselectSetting(tool);
  if (!reselect) return;
  const { key, setting } = reselect;
  const { settings, setSetting } = useToolboxStore.getState();
  const current = resolveSettings({ [key]: setting }, settings[tool.id])[key];
  setSetting(tool.id, key, nextChoice(setting, current));
}

/** Tap a tool key to switch; hold it to borrow the tool until release; press it again to reselect. */
function toolKeyHold(tool: Tool<ToolId>): CommandHold {
  return {
    press: ({ code, at }) => {
      const state = useToolboxStore.getState();
      if (state.toolId === tool.id && !state.heldTool) {
        stepReselect(tool);
        return;
      }
      state.holdToolKey(tool.id, code, at);
    },
    release: ({ code, at }) => useToolboxStore.getState().releaseToolKey(code, at),
    cancel: () => useToolboxStore.getState().dropHeldTool(),
  };
}
