export const SPRITESHEET_LAYOUTS = ["horizontal", "vertical", "grid"] as const;
export type SpritesheetLayout = (typeof SPRITESHEET_LAYOUTS)[number];

export const EXPORT_SCALES = [1, 2, 4, 8, 16] as const;
export const DEFAULT_EXPORT_SCALE = 1;

export const DEFAULT_EXPORT_OPTIONS = {
  layout: "horizontal" as SpritesheetLayout,
  columns: 4,
  scale: DEFAULT_EXPORT_SCALE,
  padding: 0,
  margin: 0,
  includeHidden: false,
  background: null as string | null,
  includeMetadata: false,
};
