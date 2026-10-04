import { MAX_FPS, MIN_FPS } from "@/constants/animation";
import { TILE_SIZE_PRESETS } from "@/constants/canvas";
import {
  BUILT_IN_DEFAULTS,
  GRID_DEFAULT_SIZES,
  ONION_OPACITY_MAX,
  ONION_OPACITY_MIN,
  type Defaults,
} from "@/constants/defaults";
import { maxTileCount } from "@/lib/tiles";

const isOneOf = (options: readonly number[], value: unknown): value is number =>
  typeof value === "number" && options.includes(value);

const isWholeIn = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/**
 * The fields of a stored defaults record that are present and valid. Anything else — a bad backup,
 * a field from a newer version — is dropped, so its built-in value applies.
 */
export function validDefaults(stored: unknown): Partial<Defaults> {
  if (!stored || typeof stored !== "object") return {};
  const raw = stored as Record<string, unknown>;
  const valid: Partial<Defaults> = {};

  if (isOneOf(TILE_SIZE_PRESETS, raw.tileSize)) valid.tileSize = raw.tileSize;
  const maxCount = maxTileCount(valid.tileSize ?? BUILT_IN_DEFAULTS.tileSize);
  if (isWholeIn(raw.spriteColumns, 1, maxCount)) valid.spriteColumns = raw.spriteColumns;
  if (isWholeIn(raw.spriteRows, 1, maxCount)) valid.spriteRows = raw.spriteRows;

  if (typeof raw.gridEnabled === "boolean") valid.gridEnabled = raw.gridEnabled;
  if (raw.gridSize === "tile" || isOneOf(GRID_DEFAULT_SIZES, raw.gridSize)) {
    valid.gridSize = raw.gridSize;
  }
  if (isOneOf(GRID_DEFAULT_SIZES, raw.checkerSize)) valid.checkerSize = raw.checkerSize;

  if (isWholeIn(raw.previewFps, MIN_FPS, MAX_FPS)) valid.previewFps = raw.previewFps;
  if (raw.paletteId === null || typeof raw.paletteId === "string") valid.paletteId = raw.paletteId;

  if (typeof raw.onionEnabled === "boolean") valid.onionEnabled = raw.onionEnabled;
  if (raw.onionDirection === "before" || raw.onionDirection === "after") {
    valid.onionDirection = raw.onionDirection;
  }
  if (
    typeof raw.onionOpacity === "number" &&
    raw.onionOpacity >= ONION_OPACITY_MIN &&
    raw.onionOpacity <= ONION_OPACITY_MAX
  ) {
    valid.onionOpacity = raw.onionOpacity;
  }

  return valid;
}

/** Every default: the valid stored ones, the built-in for the rest. */
export function resolveDefaults(stored: unknown): Defaults {
  return { ...BUILT_IN_DEFAULTS, ...validDefaults(stored) };
}
