import type { ToolControl } from "@/framework/host";
import { resolveSettings } from "@/framework/settings";
import { getTool, type ToolId } from "@/tools";
import { useToolboxStore } from "./store";

/** `ToolHost.tool`: the calling tool's own control; its settings are read and written under its id only. */
export function createToolAdapter(toolId: ToolId): ToolControl {
  const declared = getTool(toolId).settings;
  return {
    // setTool notifies subscribers synchronously, so the tool is active when this returns.
    activate: () => useToolboxStore.getState().setTool(toolId),
    settings: () => resolveSettings(declared, useToolboxStore.getState().settings[toolId]),
    set: (key, value) => useToolboxStore.getState().setSetting(toolId, String(key), value),
  };
}
