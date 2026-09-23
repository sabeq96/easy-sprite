import { TOOL_LIST } from "@/editor/tools";
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

  for (const { id: toolId, label } of TOOL_LIST) {
    const commandId = `tool.${toolId}` as const;
    registry[commandId] = {
      id: commandId,
      label,
      group: "Tools",
      isActive: () => store.getState().toolId === toolId,
      run: () => store.getState().setTool(toolId),
    };
  }

  return registry;
}
