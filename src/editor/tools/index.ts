import { bucketTool, fillSimilarTool } from "@/editor/tools/fill";
import { eraserTool } from "@/editor/tools/eraser";
import { pencilTool } from "@/editor/tools/pencil";
import { pickerTool } from "@/editor/tools/picker";
import { selectTool } from "@/editor/tools/select";
import type { Tool } from "@/editor/tools/types";

/**
 * The only list of tools, in sidebar order. Ids, tool commands, their keys and the sidebar
 * sections are all derived from it, so adding a tool means adding it here (plus its icon).
 */
export const TOOL_LIST = [
  pencilTool,
  eraserTool,
  bucketTool,
  fillSimilarTool,
  pickerTool,
  selectTool,
] as const;

export type ToolId = (typeof TOOL_LIST)[number]["id"];

export const TOOL_IDS: readonly ToolId[] = TOOL_LIST.map((tool) => tool.id);

export const TOOLS = Object.fromEntries(TOOL_LIST.map((tool) => [tool.id, tool])) as Record<
  ToolId,
  Tool<ToolId>
>;

export function getTool(id: ToolId): Tool<ToolId> {
  return TOOLS[id];
}
