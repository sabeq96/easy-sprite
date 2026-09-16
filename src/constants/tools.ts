export const TOOL_IDS = [
  "pencil",
  "mirrorPencil",
  "eraser",
  "bucket",
  "fillSimilar",
  "picker",
  "select",
  "move",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export const BRUSH_SIZES = [1, 2, 3, 4, 6, 8] as const;
export const DEFAULT_BRUSH_SIZE = 1;
export const MAX_CYCLE_BRUSH_SIZE = 4;

export const DEFAULT_FILL_TOLERANCE = 0;
export const MAX_FILL_TOLERANCE = 255;
