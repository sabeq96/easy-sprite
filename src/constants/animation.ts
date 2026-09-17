export const DEFAULT_FPS = 12;
export const MIN_FPS = 1;
export const MAX_FPS = 60;

export type OnionDirection = "before" | "after";

export const ONION_DEFAULT = {
  enabled: false,
  direction: "before" as OnionDirection,
  opacity: 0.35,
} as const;

/** The single ghost frame is always the immediate neighbour in the chosen direction. */
export function onionOffset(direction: OnionDirection): -1 | 1 {
  return direction === "before" ? -1 : 1;
}
