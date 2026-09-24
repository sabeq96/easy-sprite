/** `"Hero, walk,, Hero"` → `["hero", "walk"]`: comma-separated, trimmed, lowercase, no repeats. */
export function parseTags(text: string): string[] {
  return [
    ...new Set(
      text
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}
