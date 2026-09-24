import { describe, expect, it } from "vitest";
import { countTags, matchesSearch, queryLibrary, type LibraryEntry } from "@/lib/library";

function entry(name: string, overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return { name, tags: [], createdAt: 0, updatedAt: 0, ...overrides };
}

describe("matchesSearch", () => {
  it("matches name or tag, case-insensitively", () => {
    expect(matchesSearch(entry("Hero Walk"), "  hero ")).toBe(true);
    expect(matchesSearch(entry("Tree", { tags: ["Forest"] }), "fore")).toBe(true);
    expect(matchesSearch(entry("Tree"), "rock")).toBe(false);
  });

  it("matches everything on a blank search", () => {
    expect(matchesSearch(entry("Tree"), "   ")).toBe(true);
  });
});

describe("queryLibrary", () => {
  const items = [
    { record: entry("b", { createdAt: 1, updatedAt: 3 }) },
    { record: entry("a", { createdAt: 3, updatedAt: 1 }) },
    { record: entry("c", { createdAt: 2, updatedAt: 2, tags: ["x"] }) },
  ];
  const names = (list: typeof items) => list.map((item) => item.record.name);
  const recordOf = (item: (typeof items)[number]) => item.record;

  it("sorts newest-updated, newest-created or by name", () => {
    expect(names(queryLibrary(items, { search: "", sort: "updated" }, recordOf))).toEqual(["b", "c", "a"]);
    expect(names(queryLibrary(items, { search: "", sort: "created" }, recordOf))).toEqual(["a", "c", "b"]);
    expect(names(queryLibrary(items, { search: "", sort: "name" }, recordOf))).toEqual(["a", "b", "c"]);
  });

  it("filters before sorting and leaves the input untouched", () => {
    expect(names(queryLibrary(items, { search: "x", sort: "name" }, recordOf))).toEqual(["c"]);
    expect(names(items)).toEqual(["b", "a", "c"]);
  });
});

describe("countTags", () => {
  it("counts each tag across entries, alphabetically", () => {
    expect(countTags([entry("a", { tags: ["walk", "hero"] }), entry("b", { tags: ["hero"] })])).toEqual([
      { tag: "hero", count: 2 },
      { tag: "walk", count: 1 },
    ]);
  });
});
