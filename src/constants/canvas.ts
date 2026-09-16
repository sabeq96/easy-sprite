export const ZOOM_LEVELS = [0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32] as const;
export const DEFAULT_ZOOM = 8;

export const MIN_CANVAS_SIZE = 1;
export const MAX_CANVAS_SIZE = 512;
export const DEFAULT_CANVAS_SIZE = 32;
export const CANVAS_SIZE_PRESETS = [8, 16, 32, 48, 64, 96, 128] as const;

/** Below this zoom the pixel grid is noise, so it is hidden regardless of the toggle. */
export const GRID_MIN_SCALE = 6;
export const CHECKER_TILE_PX = 8;

export const LAYER_THUMB_PX = 48;
export const FRAME_THUMB_PX = 64;

/** Warn the user above this much pixel data in one sprite (~48 MB). */
export const SPRITE_SIZE_WARN_BYTES = 48 * 1024 * 1024;
