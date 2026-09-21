import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import type { SpriteRecord, SpritesheetRecord } from "@/db/schema";

export type LibrarySort = "updated" | "created" | "name";

export type LibraryItem =
  | { kind: "sprite"; record: SpriteRecord }
  | { kind: "spritesheet"; record: SpritesheetRecord };

export interface Library {
  items: LibraryItem[];
  /** useLiveQuery returns undefined on the first render; loading and empty must look different. */
  isLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  sort: LibrarySort;
  setSort: (value: LibrarySort) => void;
  tag: string | null;
  setTag: (value: string | null) => void;
  allTags: { tag: string; count: number }[];
}

const COMPARATORS: Record<LibrarySort, (a: LibraryItem, b: LibraryItem) => number> = {
  updated: (a, b) => b.record.updatedAt - a.record.updatedAt,
  created: (a, b) => b.record.createdAt - a.record.createdAt,
  name: (a, b) => a.record.name.localeCompare(b.record.name),
};

/** Sprites and spritesheets, merged into one searchable/sortable gallery. */
export function useLibrary(): Library {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<LibrarySort>("updated");
  const [tag, setTag] = useState<string | null>(null);

  const items = useLiveQuery(async () => {
    const [sprites, spritesheets] = await Promise.all([
      tag ? db.sprites.where("tags").equals(tag).toArray() : db.sprites.toArray(),
      tag ? db.spritesheets.where("tags").equals(tag).toArray() : db.spritesheets.toArray(),
    ]);

    const merged: LibraryItem[] = [
      ...sprites.map((record): LibraryItem => ({ kind: "sprite", record })),
      ...spritesheets.map((record): LibraryItem => ({ kind: "spritesheet", record })),
    ];

    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? merged.filter(
          (item) =>
            item.record.name.toLowerCase().includes(needle) ||
            item.record.tags.some((entry) => entry.toLowerCase().includes(needle)),
        )
      : merged;

    return filtered.sort(COMPARATORS[sort]);
  }, [search, sort, tag]);

  const allTags = useLiveQuery(
    async () => {
      const [sprites, spritesheets] = await Promise.all([
        db.sprites.toArray(),
        db.spritesheets.toArray(),
      ]);

      const counts = new Map<string, number>();
      for (const record of [...sprites, ...spritesheets]) {
        for (const entry of record.tags) counts.set(entry, (counts.get(entry) ?? 0) + 1);
      }

      return [...counts.entries()]
        .map(([entry, count]) => ({ tag: entry, count }))
        .sort((a, b) => a.tag.localeCompare(b.tag));
    },
    [],
    [],
  );

  return {
    items: items ?? [],
    isLoading: items === undefined,
    search,
    setSearch,
    sort,
    setSort,
    tag,
    setTag,
    allTags,
  };
}
