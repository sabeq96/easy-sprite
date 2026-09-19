import { DEFAULT_BRUSH_SIZE, MAX_CYCLE_BRUSH_SIZE, type ToolId } from "@/constants/tools";
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
    pickFromComposite: true,
  },

  /**
   * Mirror is a pencil-only option, but the brush preview draws its mirrored cells for any tool
   * that has a brush cursor — so leaving it set while switching to the eraser highlights pixels
   * that will never be touched. Clearing it on a real tool change keeps the preview honest.
   * Re-selecting the current tool leaves it alone, and so does a held modifier tool, which
   * restores the previous tool rather than choosing a new one.
   */
  setTool: (toolId) =>
    set((state) =>
      state.toolId === toolId
        ? { toolId, previousToolId: null }
        : {
            toolId,
            previousToolId: null,
            toolOptions: {
              ...state.toolOptions,
              mirrorHorizontal: false,
              mirrorVertical: false,
            },
          },
    ),

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
