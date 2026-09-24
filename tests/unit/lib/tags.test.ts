import { describe, expect, it } from "vitest";
import { parseTags } from "@/lib/tags";

describe("parseTags", () => {
  it("splits on commas, trims, lowercases and drops empties and repeats", () => {
    expect(parseTags(" Hero, walk,, HERO ,")).toEqual(["hero", "walk"]);
  });

  it("returns no tags for blank input", () => {
    expect(parseTags("  ")).toEqual([]);
  });
});
