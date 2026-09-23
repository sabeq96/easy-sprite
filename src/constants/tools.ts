export const TOOL_IDS = [
  "pencil",
  "eraser",
  "bucket",
  "fillSimilar",
  "picker",
  "select",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export const BRUSH_SIZES = [1, 2, 3, 4, 6, 8] as const;
export const DEFAULT_BRUSH_SIZE = 1;
export const MAX_CYCLE_BRUSH_SIZE = 4;
