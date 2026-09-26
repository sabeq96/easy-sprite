import { SHEET_TILE_OPTIONS } from "@/constants/builder";
import { MAX_CANVAS_SIZE, TILE_SIZE_PRESETS } from "@/constants/canvas";
import { clamp } from "@/lib/math";

/** Most tiles of `tile` px that fit along one axis without passing the max canvas size. */
export function maxTileCount(tile: number): number {
  return Math.max(1, Math.floor(MAX_CANVAS_SIZE / tile));
}

/** Tiles of `tile` px needed to cover `px`, rounded up and kept within the canvas limit. */
export function tileCountFor(px: number, tile: number): number {
  return clamp(Math.ceil(px / tile), 1, maxTileCount(tile));
}

/**
 * The tile size of a sprite that never recorded one (older sprites, PNG imports, splits): the
 * largest preset that divides both sides, or undefined when none does.
 */
export function inferTileSize(width: number, height: number): number | undefined {
  return [...TILE_SIZE_PRESETS].reverse().find((tile) => width % tile === 0 && height % tile === 0);
}

/** Grid and chessboard sizes a sheet offers: the fixed ladder plus the sheet's own tile. */
export function sheetTileOptions(tile: number): number[] {
  return [...new Set([...SHEET_TILE_OPTIONS, tile])].sort((a, b) => a - b);
}
