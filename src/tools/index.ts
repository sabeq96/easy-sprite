import { bucketTool, fillSimilarTool } from "@/tools/fill/tool";
import { eraserTool } from "@/tools/eraser/tool";
import { pencilTool } from "@/tools/pencil/tool";
import { pickerTool } from "@/tools/picker/tool";
import { selectTool } from "@/tools/select/tool";
import { shapeTool } from "@/tools/shape/tool";
import type { ContributedCommand } from "@/framework/command";
import type { SettingCommandIdOf, Settings } from "@/framework/settings";
import type { Tool } from "@/framework/tool";

/**
 * The only list of tools, in sidebar order. Ids, tool commands, their keys and the sidebar
 * sections are all derived from it, so adding a tool means its folder plus one line here.
 */
export const TOOL_LIST = [
  pencilTool,
  eraserTool,
  shapeTool,
  bucketTool,
  fillSimilarTool,
  pickerTool,
  selectTool,
] as const;

export type ToolId = (typeof TOOL_LIST)[number]["id"];

/** Every command id a tool contributes (`edit.copy`, …), kept literal by `defineTool`. */
export type ContributedCommandId = (typeof TOOL_LIST)[number] extends infer T
  ? T extends Tool<string, infer C extends readonly ContributedCommand[]>
    ? C[number]["id"]
    : never
  : never;

/** Every command id a tool's settings declare (`tool.toggleMirror`), kept literal the same way. */
export type SettingCommandId = (typeof TOOL_LIST)[number] extends infer T
  ? T extends Tool<string, readonly ContributedCommand[], infer S extends Settings>
    ? SettingCommandIdOf<S>
    : never
  : never;

export const TOOLS = Object.fromEntries(TOOL_LIST.map((tool) => [tool.id, tool])) as Record<
  ToolId,
  Tool<ToolId>
>;

export function getTool(id: ToolId): Tool<ToolId> {
  return TOOLS[id];
}
