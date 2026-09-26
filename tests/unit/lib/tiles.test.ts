import { describe, expect, it } from "vitest";
import { inferTileSize, maxTileCount, sheetTileOptions, tileCountFor } from "@/lib/tiles";

describe("maxTileCount", () => {
  it("keeps the canvas within 512px", () => {
    expect(maxTileCount(8)).toBe(64);
    expect(maxTileCount(24)).toBe(21);
    expect(maxTileCount(64)).toBe(8);
  });
});

describe("tileCountFor", () => {
  it("rounds up so the canvas still covers every pixel", () => {
    expect(tileCountFor(32, 16)).toBe(2);
    expect(tileCountFor(20, 8)).toBe(3);
  });

  it("never goes below one tile or past the cap", () => {
    expect(tileCountFor(4, 64)).toBe(1);
    expect(tileCountFor(512, 24)).toBe(21);
  });
});

describe("inferTileSize", () => {
  it("is the largest preset dividing both sides", () => {
    expect(inferTileSize(64, 32)).toBe(32);
    expect(inferTileSize(48, 96)).toBe(48);
    expect(inferTileSize(24, 48)).toBe(24);
  });

  it("is undefined when no preset divides both", () => {
    expect(inferTileSize(20, 30)).toBeUndefined();
    expect(inferTileSize(8, 12)).toBeUndefined();
  });
});

describe("sheetTileOptions", () => {
  it("merges the sheet's tile into the fixed ladder, sorted", () => {
    expect(sheetTileOptions(16)).toEqual([1, 2, 4, 8, 16, 32, 64]);
    expect(sheetTileOptions(24)).toEqual([1, 2, 4, 8, 16, 24, 32, 64]);
  });
});
