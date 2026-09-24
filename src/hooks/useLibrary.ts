import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { listSprites } from "@/db/repositories/sprites";
import { listSpritesheets } from "@/db/repositories/spritesheets";
import type { SpriteRecord, SpritesheetRecord } from "@/db/schema";
import { countTags, queryLibrary, type LibrarySort, type TagCount } from "@/lib/library";

export type { LibrarySort };

export type LibraryItem =
  | { kind: "sprite"; record: SpriteRecord }
  | { kind: "spritesheet"; record: SpritesheetRecord };

export type LibraryKind = LibraryItem["kind"];

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
  allTags: TagCount[];
}

const NO_TAGS: TagCount[] = [];

/** `kind` narrows to one kind of item; omitted, every kind is listed. */
async function listItems(kind: LibraryKind | undefined, tag: string | null): Promise<LibraryItem[]> {
  const [sprites, spritesheets] = await Promise.all([
    kind === undefined || kind === "sprite" ? listSprites(tag) : [],
    kind === undefined || kind === "spritesheet" ? listSpritesheets(tag) : [],
  ]);
  return [
    ...sprites.map((record): LibraryItem => ({ kind: "sprite", record })),
    ...spritesheets.map((record): LibraryItem => ({ kind: "spritesheet", record })),
  ];
}

/** Library items (all kinds, or just `kind`) as one searchable, sortable, tag-filtered list. */
export function useLibrary(kind?: LibraryKind): Library {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<LibrarySort>("updated");
  const [tag, setTag] = useState<string | null>(null);

  // Dexie re-runs these whenever a row they read changes; deps behave like useEffect deps.
  const items = useLiveQuery(
    async () => queryLibrary(await listItems(kind, tag), { search, sort }, (item) => item.record),
    [kind, search, sort, tag],
  );

  const allTags = useLiveQuery(
    async () => countTags((await listItems(kind, null)).map((item) => item.record)),
    [kind],
    NO_TAGS,
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
