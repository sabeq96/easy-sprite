import { bucketTool, fillSimilarTool } from "@/tools/fill/tool";
import { eraserTool } from "@/tools/eraser/tool";
import { pencilTool } from "@/tools/pencil/tool";
import { pickerTool } from "@/tools/picker/tool";
import { selectTool } from "@/tools/select/tool";
import type { Tool } from "@/framework/tool";

/**
 * The only list of tools, in sidebar order. Ids, tool commands, their keys and the sidebar
 * sections are all derived from it, so adding a tool means its folder plus one line here.
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

export const TOOLS = Object.fromEntries(TOOL_LIST.map((tool) => [tool.id, tool])) as Record<
  ToolId,
  Tool<ToolId>
>;

export function getTool(id: ToolId): Tool<ToolId> {
  return TOOLS[id];
}
