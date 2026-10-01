import { describe, expect, it } from "vitest";
import { defaultGridSize, snapTileSize, tileSizeOptions } from "@/editor/grid";

describe("tileSizeOptions", () => {
  it("only includes sizes that evenly divide both dimensions", () => {
    expect(tileSizeOptions(20, 15, 32)).toEqual([1, 5]);
  });

  it("caps options at max", () => {
    expect(tileSizeOptions(64, 64, 8)).toEqual([1, 2, 4, 8]);
  });

  it("falls back to 1px for coprime dimensions", () => {
    expect(tileSizeOptions(17, 20, 32)).toEqual([1]);
  });
});

describe("snapTileSize", () => {
  it("keeps a preferred size that is already valid", () => {
    expect(snapTileSize(5, [1, 5])).toBe(5);
  });

  it("snaps to the closest valid size", () => {
    expect(snapTileSize(8, [1, 5])).toBe(5);
    expect(snapTileSize(2, [1, 5])).toBe(1);
  });
});

describe("defaultGridSize", () => {
  it("is the sprite's tile when it has one", () => {
    expect(defaultGridSize(8, 64, 32)).toBe(8);
  });

  it("infers the tile from the sprite's size when it has none", () => {
    expect(defaultGridSize(undefined, 64, 32)).toBe(32);
  });

  it("falls back to the even divisor closest to 16 when no preset fits", () => {
    expect(defaultGridSize(undefined, 20, 30)).toBe(10);
    expect(defaultGridSize(undefined, 17, 20)).toBe(1);
  });
});
