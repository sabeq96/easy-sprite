import type { ToolId } from "@/constants/tools";
import { bucketTool, fillSimilarTool } from "@/editor/tools/fill";
import { eraserTool } from "@/editor/tools/eraser";
import { pencilTool } from "@/editor/tools/pencil";
import { pickerTool } from "@/editor/tools/picker";
import { selectTool } from "@/editor/tools/select";
import type { Tool } from "@/editor/tools/types";

// Registry barrel: the collection itself is the API.
export const TOOLS: Record<ToolId, Tool> = {
  pencil: pencilTool,
  eraser: eraserTool,
  bucket: bucketTool,
  fillSimilar: fillSimilarTool,
  picker: pickerTool,
  select: selectTool,
};

export function getTool(id: ToolId): Tool {
  return TOOLS[id];
}
