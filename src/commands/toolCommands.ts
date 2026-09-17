import { TOOL_IDS } from "@/constants/tools";
import { TOOLS } from "@/editor/tools";
import type { CommandRegistry } from "@/commands/types";
import type { EditorStore } from "@/stores/slices/types";
import type { StoreApi, UseBoundStore } from "zustand";

type Store = UseBoundStore<StoreApi<EditorStore>>;

/** One command per tool, generated from the registry so the two cannot drift. */
export function createToolCommands(store: Store): CommandRegistry {
  const registry: CommandRegistry = {
    "tool.cycleBrushSize": {
      id: "tool.cycleBrushSize",
      label: "Cycle brush size",
      group: "Tools",
      run: () => store.getState().cycleBrushSize(),
    },
  };

  for (const toolId of TOOL_IDS) {
    const commandId = `tool.${toolId}` as const;
    registry[commandId] = {
      id: commandId,
      label: TOOLS[toolId].label,
      group: "Tools",
      isActive: () => store.getState().toolId === toolId,
      run: () => store.getState().setTool(toolId),
    };
  }

  return registry;
}
