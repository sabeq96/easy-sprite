/** `plural(1, "frame")` → `"1 frame"`, `plural(3, "frame")` → `"3 frames"`. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** An item's name, or the default when it is blank. */
export function nameOrDefault(name: string | undefined, fallback: string): string {
  return name?.trim() || fallback;
}
