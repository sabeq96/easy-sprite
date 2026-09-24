export type LibrarySort = "updated" | "created" | "name";

/** What the library needs from any item it lists — sprites and spritesheets both fit. */
export interface LibraryEntry {
  name: string;
  tags: readonly string[];
  createdAt: number;
  updatedAt: number;
}

export interface LibraryQuery {
  search: string;
  sort: LibrarySort;
}

export interface TagCount {
  tag: string;
  count: number;
}

const COMPARATORS: Record<LibrarySort, (a: LibraryEntry, b: LibraryEntry) => number> = {
  updated: (a, b) => b.updatedAt - a.updatedAt,
  created: (a, b) => b.createdAt - a.createdAt,
  name: (a, b) => a.name.localeCompare(b.name),
};

/** Case-insensitive substring match on the name or any tag; a blank search matches everything. */
export function matchesSearch(entry: LibraryEntry, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return (
    entry.name.toLowerCase().includes(needle) ||
    entry.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
}

/** Filters and sorts without mutating `items`; `entryOf` reads the entry off a wrapped item. */
export function queryLibrary<T>(
  items: readonly T[],
  { search, sort }: LibraryQuery,
  entryOf: (item: T) => LibraryEntry,
): T[] {
  const compare = COMPARATORS[sort];
  return items
    .filter((item) => matchesSearch(entryOf(item), search))
    .sort((a, b) => compare(entryOf(a), entryOf(b)));
}

/** Every tag in use, with how many entries carry it, alphabetically. */
export function countTags(entries: Iterable<LibraryEntry>): TagCount[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}
