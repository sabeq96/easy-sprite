import type { ToolId } from "@/constants/tools";

/** Display-only hints for tooltips; phase 11 owns the real keymap. */
export const TOOL_SHORTCUT_HINTS: Record<ToolId, string> = {
  pencil: "P",
  mirrorPencil: "V",
  eraser: "E",
  bucket: "B",
  fillSimilar: "G",
  picker: "O",
  select: "S",
  move: "M",
};
