import {
  DEFAULT_BRUSH_SIZE,
  DEFAULT_FILL_TOLERANCE,
  MAX_CYCLE_BRUSH_SIZE,
  type ToolId,
} from "@/constants/tools";
import type { ToolOptions } from "@/editor/tools/types";
import type { SliceCreator } from "@/stores/slices/types";

export interface ToolSlice {
  toolId: ToolId;
  /** Restored when a held modifier (Alt) releases. */
  previousToolId: ToolId | null;
  toolOptions: ToolOptions;

  setTool: (toolId: ToolId) => void;
  pushTemporaryTool: (toolId: ToolId) => void;
  popTemporaryTool: () => void;
  setToolOptions: (patch: Partial<ToolOptions>) => void;
  cycleBrushSize: () => void;
}

export const createToolSlice: SliceCreator<ToolSlice> = (set, get) => ({
  toolId: "pencil",
  previousToolId: null,
  toolOptions: {
    brushSize: DEFAULT_BRUSH_SIZE,
    mirrorHorizontal: false,
    mirrorVertical: false,
    fillTolerance: DEFAULT_FILL_TOLERANCE,
    pickFromComposite: true,
  },

  setTool: (toolId) => set({ toolId, previousToolId: null }),

  pushTemporaryTool: (toolId) => {
    const { previousToolId, toolId: current } = get();
    if (previousToolId || current === toolId) return; // already holding one
    set({ previousToolId: current, toolId });
  },

  popTemporaryTool: () => {
    const previous = get().previousToolId;
    if (previous) set({ toolId: previous, previousToolId: null });
  },

  setToolOptions: (patch) =>
    set(({ toolOptions }) => ({ toolOptions: { ...toolOptions, ...patch } })),

  cycleBrushSize: () =>
    set(({ toolOptions }) => ({
      toolOptions: {
        ...toolOptions,
        brushSize: (toolOptions.brushSize % MAX_CYCLE_BRUSH_SIZE) + 1,
      },
    })),
});
