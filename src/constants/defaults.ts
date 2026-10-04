import { DEFAULT_FPS, ONION_DEFAULT, type OnionDirection } from "@/constants/animation";
import { SHEET_TILE_OPTIONS } from "@/constants/builder";
import { DEFAULT_CHECKER_SIZE, DEFAULT_TILE_COUNT, DEFAULT_TILE_SIZE } from "@/constants/canvas";

/**
 * What the user can set on the Settings page. Each value applies when something is created or
 * opened; it never rewrites an existing sprite.
 */
export interface Defaults {
  /** One of TILE_SIZE_PRESETS; seeds both the New Sprite and New Spritesheet dialogs. */
  tileSize: number;
  /** A new sprite's columns and rows, each 1..maxTileCount(tileSize). */
  spriteColumns: number;
  spriteRows: number;
  gridEnabled: boolean;
  /** "tile" follows the sprite's or sheet's own tile; a number is one of GRID_DEFAULT_SIZES. */
  gridSize: "tile" | number;
  /** One of GRID_DEFAULT_SIZES. */
  checkerSize: number;
  /** A whole number, MIN_FPS..MAX_FPS. */
  previewFps: number;
  /** The palette the panel shows on open; null (or a deleted id) means the first palette. */
  paletteId: string | null;
  onionEnabled: boolean;
  onionDirection: OnionDirection;
  /** ONION_OPACITY_MIN..ONION_OPACITY_MAX. */
  onionOpacity: number;
}

/** What the app does when the user has set nothing — the same values it used before defaults existed. */
export const BUILT_IN_DEFAULTS: Defaults = {
  tileSize: DEFAULT_TILE_SIZE,
  spriteColumns: DEFAULT_TILE_COUNT,
  spriteRows: DEFAULT_TILE_COUNT,
  gridEnabled: true,
  gridSize: "tile",
  checkerSize: DEFAULT_CHECKER_SIZE,
  previewFps: DEFAULT_FPS,
  paletteId: null,
  onionEnabled: ONION_DEFAULT.enabled,
  onionDirection: ONION_DEFAULT.direction,
  onionOpacity: ONION_DEFAULT.opacity,
};

/** Fixed grid and chessboard sizes a default may name; the editor snaps them to each sprite. */
export const GRID_DEFAULT_SIZES = SHEET_TILE_OPTIONS;

/** The onion opacity slider's range, as a 0–1 fraction. */
export const ONION_OPACITY_MIN = 0.1;
export const ONION_OPACITY_MAX = 0.8;
