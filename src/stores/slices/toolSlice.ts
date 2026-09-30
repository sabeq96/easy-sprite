import { TOOL_KEY_HOLD_MS } from "@/constants/shortcuts";
import { DEFAULT_BRUSH_SIZE, MAX_CYCLE_BRUSH_SIZE } from "@/constants/tools";
import type { ToolId } from "@/editor/tools";
import type { ToolOptions } from "@/editor/tools/types";
import type { SliceCreator } from "@/stores/slices/types";

/** A tool key being held: it has switched tools, and its release decides whether that sticks. */
export interface HeldTool {
  /** The physical key holding the tool (`KeyboardEvent.code`); only its release resolves the hold. */
  code: string;
  /** `KeyboardEvent.timeStamp` of that key's first keydown. */
  pressedAt: number;
  /** The tool active before the first key of this hold; kept through a takeover. */
  restoreToolId: ToolId;
}

export interface ToolSlice {
  toolId: ToolId;
  heldTool: HeldTool | null;
  toolOptions: ToolOptions;

  setTool: (toolId: ToolId) => void;
  /** Switches to `toolId` now; `releaseToolKey` later decides between a tap and a hold. */
  holdToolKey: (toolId: ToolId, code: string, at: number) => void;
  /** A tap keeps the tool as if it were clicked; a hold hands back the tool from before it. */
  releaseToolKey: (code: string, at: number) => void;
  /** The key's release will never arrive (window blur): hand back the tool from before it. */
  dropHeldTool: () => void;
  setToolOptions: (patch: Partial<ToolOptions>) => void;
  cycleBrushSize: () => void;
}

export const createToolSlice: SliceCreator<ToolSlice> = (set, get) => ({
  toolId: "pencil",
  heldTool: null,
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
   * Re-selecting the current tool leaves it alone, and so does a held tool key, which restores
   * the previous tool rather than choosing a new one.
   */
  setTool: (toolId) =>
    set((state) =>
      state.toolId === toolId
        ? { toolId, heldTool: null }
        : { toolId, heldTool: null, toolOptions: withoutMirror(state.toolOptions) },
    ),

  holdToolKey: (toolId, code, at) => {
    const { toolId: current, heldTool } = get();
    if (heldTool?.code === code) return;
    // A second key held during a hold takes over, but still hands back the tool from before the first.
    const restoreToolId = heldTool?.restoreToolId ?? current;
    set({ toolId, heldTool: { code, pressedAt: at, restoreToolId } });
  },

  releaseToolKey: (code, at) => {
    const { heldTool, toolId, toolOptions } = get();
    if (!heldTool || heldTool.code !== code) return;

    if (at - heldTool.pressedAt >= TOOL_KEY_HOLD_MS) {
      set({ heldTool: null, toolId: heldTool.restoreToolId });
      return;
    }

    // A tap is a real choice: it ends exactly where clicking the tool would (see `setTool`).
    const changed = toolId !== heldTool.restoreToolId;
    set({ heldTool: null, toolOptions: changed ? withoutMirror(toolOptions) : toolOptions });
  },

  dropHeldTool: () => {
    const { heldTool } = get();
    if (heldTool) set({ heldTool: null, toolId: heldTool.restoreToolId });
  },

  setToolOptions: (patch) =>
    set(({ toolOptions }) => ({ toolOptions: { ...toolOptions, ...patch } })),

  cycleBrushSize: () =>
    set(({ toolOptions }) => ({
      toolOptions: {
        ...toolOptions,
        // Sizes past the cycle (6 and 8, from the options bar) start it over rather than landing mid-way.
        brushSize: toolOptions.brushSize >= MAX_CYCLE_BRUSH_SIZE ? 1 : toolOptions.brushSize + 1,
      },
    })),
});

function withoutMirror(options: ToolOptions): ToolOptions {
  return { ...options, mirrorHorizontal: false, mirrorVertical: false };
}
