export const ZOOM_LEVELS = [0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48] as const;
export const DEFAULT_ZOOM = 8;
/** Space kept around the sprite when fitting it, and how far past its edges an overflowing sprite scrolls. */
export const VIEW_PADDING = 24;
/** Wheel and pinch zoom multiply the scale by WHEEL_ZOOM_BASE per WHEEL_ZOOM_DELTA px of deltaY (Piskel's ⌘ rate). */
export const WHEEL_ZOOM_BASE = 4 / 3;
export const WHEEL_ZOOM_DELTA = 120;

export const MIN_CANVAS_SIZE = 1;
export const MAX_CANVAS_SIZE = 512;
/** Frame sizes the split dialog offers. Sprites themselves are sized in tiles (see TILE_SIZE_PRESETS). */
export const CANVAS_SIZE_PRESETS = [8, 16, 32, 48, 64, 96, 128] as const;

/** The only tile sizes a sprite or sheet can have. A sprite is always a whole number of tiles. */
export const TILE_SIZE_PRESETS = [8, 16, 24, 32, 48, 64] as const;
export const DEFAULT_TILE_SIZE = 16;
/** A new sprite's columns and rows: 16 × 2×2 = 32×32. */
export const DEFAULT_TILE_COUNT = 2;

/** Below this effective cell size (scale * gridSize) the grid is noise, hidden regardless of the toggle. */
export const GRID_MIN_SCALE = 6;

/** CSS px width of the grid overlay lines, before DPR scaling. */
export const GRID_LINE_WIDTH = 1.5;

export const MAX_GRID_SIZE = 64;

export const MAX_CHECKER_SIZE = 64;
/** A 2×2-tile checkerboard in the theme's checker colors; set `background-size` to twice the tile. */
export const CHECKER_GRADIENT =
  "conic-gradient(var(--checker-a) 25%, var(--checker-b) 0 50%, var(--checker-a) 0 75%, var(--checker-b) 0)";
export const DEFAULT_CHECKER_SIZE = 1;

export const LAYER_THUMB_PX = 48;
export const FRAME_THUMB_PX = 64;

/** Warn the user above this much pixel data in one sprite (~48 MB). */
export const SPRITE_SIZE_WARN_BYTES = 48 * 1024 * 1024;
