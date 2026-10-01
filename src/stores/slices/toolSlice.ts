import { TOOL_KEY_HOLD_MS } from "@/constants/shortcuts";
import type { ToolId } from "@/tools";
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

  setTool: (toolId: ToolId) => void;
  /** Switches to `toolId` now; `releaseToolKey` later decides between a tap and a hold. */
  holdToolKey: (toolId: ToolId, code: string, at: number) => void;
  /** A tap keeps the tool as if it were clicked; a hold hands back the tool from before it. */
  releaseToolKey: (code: string, at: number) => void;
  /** The key's release will never arrive (window blur): hand back the tool from before it. */
  dropHeldTool: () => void;
}

export const createToolSlice: SliceCreator<ToolSlice> = (set, get) => ({
  toolId: "pencil",
  heldTool: null,

  setTool: (toolId) => set({ toolId, heldTool: null }),

  holdToolKey: (toolId, code, at) => {
    const { toolId: current, heldTool } = get();
    if (heldTool?.code === code) return;
    // A second key held during a hold takes over, but still hands back the tool from before the first.
    const restoreToolId = heldTool?.restoreToolId ?? current;
    set({ toolId, heldTool: { code, pressedAt: at, restoreToolId } });
  },

  releaseToolKey: (code, at) => {
    const { heldTool } = get();
    if (!heldTool || heldTool.code !== code) return;

    // A hold hands back the tool from before it; a tap keeps the tool, as clicking it would.
    const held = at - heldTool.pressedAt >= TOOL_KEY_HOLD_MS;
    set(held ? { heldTool: null, toolId: heldTool.restoreToolId } : { heldTool: null });
  },

  dropHeldTool: () => {
    const { heldTool } = get();
    if (heldTool) set({ heldTool: null, toolId: heldTool.restoreToolId });
  },
});
