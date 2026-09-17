import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import type { SpriteRecord } from "@/db/schema";

export type SpriteSort = "updated" | "created" | "name";

export interface SpriteLibrary {
  sprites: SpriteRecord[];
  /** useLiveQuery returns undefined on the first render; loading and empty must look different. */
  isLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  sort: SpriteSort;
  setSort: (value: SpriteSort) => void;
  tag: string | null;
  setTag: (value: string | null) => void;
  allTags: string[];
}

const COMPARATORS: Record<SpriteSort, (a: SpriteRecord, b: SpriteRecord) => number> = {
  updated: (a, b) => b.updatedAt - a.updatedAt,
  created: (a, b) => b.createdAt - a.createdAt,
  name: (a, b) => a.name.localeCompare(b.name),
};

export function useSpriteLibrary(): SpriteLibrary {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SpriteSort>("updated");
  const [tag, setTag] = useState<string | null>(null);

  // Dexie re-runs this whenever a row it read changes; deps behave like useEffect deps.
  const sprites = useLiveQuery(async () => {
    const rows = tag
      ? await db.sprites.where("tags").equals(tag).toArray()
      : await db.sprites.toArray();

    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? rows.filter(
          (sprite) =>
            sprite.name.toLowerCase().includes(needle) ||
            sprite.tags.some((entry) => entry.toLowerCase().includes(needle)),
        )
      : rows;

    return filtered.sort(COMPARATORS[sort]);
  }, [search, sort, tag]);

  const allTags = useLiveQuery(
    async () => {
      const rows = await db.sprites.toArray();
      return [...new Set(rows.flatMap((sprite) => sprite.tags))].sort();
    },
    [],
    [],
  );

  return {
    sprites: sprites ?? [],
    isLoading: sprites === undefined,
    search,
    setSearch,
    sort,
    setSort,
    tag,
    setTag,
    allTags,
  };
}
