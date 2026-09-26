/** `plural(1, "frame")` → `"1 frame"`, `plural(3, "frame")` → `"3 frames"`. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** An item's name, or the default when it is blank. */
export function nameOrDefault(name: string | undefined, fallback: string): string {
  return name?.trim() || fallback;
}

/** A zoom scale as the multiplier shown between the zoom buttons: `0.5` → `"0.5×"`, `8` → `"8×"`. */
export function formatZoom(scale: number): string {
  return `${scale}×`;
}
