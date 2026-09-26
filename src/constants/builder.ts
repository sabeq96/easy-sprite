/** On-screen display scales. Sprite-resolution px are too small to drag comfortably at 1×. */
export const BUILDER_ZOOM_LEVELS = [1, 2, 3, 4, 6, 8, 12] as const;
export const DEFAULT_BUILDER_ZOOM = 4;

/**
 * Grid and chessboard sizes, in sprite px. A sheet has no fixed size to divide, so these are a fixed
 * ladder; the sheet's own tile size is merged in (see `sheetTileOptions`). Blocks pack tight, so a
 * block may straddle a grid line — the grid is for reading row alignment, not a snap target.
 */
export const SHEET_TILE_OPTIONS = [1, 2, 4, 8, 16, 32, 64] as const;

/** Below this many screen px per cell the ruler is noise, hidden regardless of the toggle. */
export const BUILDER_GRID_MIN_SCALE = 6;

/** Theme-independent, matching the pixel editor's grid (see `renderer.drawGrid`). */
export const BUILDER_GRID_LINE = "rgba(128,128,128,0.35)";

/**
 * How far a row boundary's "new row" strip reaches into each neighbouring row, in screen px — at
 * most this, and never more than ROW_GUTTER_MAX_SHARE of that row's height, so a short row at low
 * zoom keeps a middle you can still drop into.
 */
export const ROW_GUTTER_REACH_PX = 4;
export const ROW_GUTTER_MAX_SHARE = 0.25;

/**
 * Below this many screen px in either dimension a block draws no remove button or name caption:
 * they would cover the whole block, and the block itself is the drag handle. The button stays
 * reachable by keyboard; dragging the block onto the dock removes it by pointer.
 */
export const BUILDER_BLOCK_CHROME_MIN_PX = 48;

/** A block whose sprite record hasn't been read yet still needs some footprint to render at. */
export const BUILDER_FALLBACK_BLOCK_PX = 16;
