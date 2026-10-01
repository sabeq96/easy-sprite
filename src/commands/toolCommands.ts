import type { Hint } from "@/commands/hints";
import type { CommandHold, CommandRegistry } from "@/commands/types";
import { getTool, TOOL_LIST, type ToolId } from "@/tools";
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
  const registry: CommandRegistry = {
    "tool.cycleBrushSize": {
      id: "tool.cycleBrushSize",
      label: "Cycle brush size",
      group: "Tools",
      run: () => store.getState().cycleBrushSize(),
    },
    "tool.toggleMirror": {
      id: "tool.toggleMirror",
      label: "Mirror horizontally",
      group: "Tools",
      isEnabled: () => getTool(store.getState().toolId).options.includes("mirror"),
      isActive: () => store.getState().toolOptions.mirrorHorizontal,
      run: () => {
        const { toolOptions, setToolOptions } = store.getState();
        setToolOptions({ mirrorHorizontal: !toolOptions.mirrorHorizontal });
      },
    },
  };

  for (const tool of TOOL_LIST) {
    const commandId = `tool.${tool.id}` as const;
    registry[commandId] = {
      id: commandId,
      label: tool.label,
      group: "Tools",
      isActive: () => store.getState().toolId === tool.id,
      run: () => store.getState().setTool(tool.id),
      hold: toolKeyHold(store, tool, registry),
    };
  }

  return registry;
}

/** Tap a tool key to switch; hold it to borrow the tool until release; press it again to reselect. */
function toolKeyHold(store: Store, tool: Tool<ToolId>, registry: CommandRegistry): CommandHold {
  return {
    press: ({ code, at }) => {
      const state = store.getState();
      if (state.toolId === tool.id && !state.heldTool) {
        const reselect = tool.reselectCommand && registry[tool.reselectCommand];
        if (reselect && reselect.isEnabled?.() !== false) reselect.run();
        return;
      }
      state.holdToolKey(tool.id, code, at);
    },
    release: ({ code, at }) => store.getState().releaseToolKey(code, at),
    cancel: () => store.getState().dropHeldTool(),
  };
}
