import type { Hint } from "@/commands/hints";
import type { CommandHold, CommandRegistry } from "@/commands/types";
import { TOOL_LIST, type ToolId } from "@/tools";
import { nextChoice, resolveSettings, type ChoiceSetting } from "@/framework/settings";
import type { Tool } from "@/framework/tool";
import type { EditorStore } from "@/stores/slices/types";
import type { StoreApi, UseBoundStore } from "zustand";

type Store = UseBoundStore<StoreApi<EditorStore>>;

/** Every tool key springs back when held; the sheet teaches it once rather than on every row. */
export const TOOL_KEY_HOLD_HINT: Hint = {
  action: "Use a tool until you let go",
  inputs: [{ text: "Hold tool key" }],
};

/** One command per tool, generated from the registry so the two cannot drift. */
export function createToolCommands(store: Store): CommandRegistry {
  const registry: CommandRegistry = {};

  for (const tool of TOOL_LIST) {
    const commandId = `tool.${tool.id}` as const;
    registry[commandId] = {
      id: commandId,
      label: tool.label,
      group: "Tools",
      isActive: () => store.getState().toolId === tool.id,
      run: () => store.getState().setTool(tool.id),
      hold: toolKeyHold(store, tool),
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
function stepReselect(store: Store, tool: Tool<ToolId>): void {
  const reselect = reselectSetting(tool);
  if (!reselect) return;
  const { key, setting } = reselect;
  const { settings, setSetting } = store.getState();
  const current = resolveSettings({ [key]: setting }, settings[tool.id])[key];
  setSetting(tool.id, key, nextChoice(setting, current));
}

/** Tap a tool key to switch; hold it to borrow the tool until release; press it again to reselect. */
function toolKeyHold(store: Store, tool: Tool<ToolId>): CommandHold {
  return {
    press: ({ code, at }) => {
      const state = store.getState();
      if (state.toolId === tool.id && !state.heldTool) {
        stepReselect(store, tool);
        return;
      }
      state.holdToolKey(tool.id, code, at);
    },
    release: ({ code, at }) => store.getState().releaseToolKey(code, at),
    cancel: () => store.getState().dropHeldTool(),
  };
}
