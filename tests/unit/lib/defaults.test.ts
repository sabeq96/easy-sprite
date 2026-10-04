import { describe, expect, it } from "vitest";
import { BUILT_IN_DEFAULTS } from "@/constants/defaults";
import { resolveDefaults, validDefaults } from "@/lib/defaults";

describe("resolveDefaults", () => {
  it("falls back per field", () => {
    expect(resolveDefaults(undefined)).toEqual(BUILT_IN_DEFAULTS);
    expect(resolveDefaults("x")).toEqual(BUILT_IN_DEFAULTS);

    const resolved = resolveDefaults({
      tileSize: 20,
      previewFps: 0,
      onionOpacity: 2,
      onionDirection: "up",
      gridSize: 3,
      somethingNew: true,
      gridEnabled: false,
      checkerSize: 4,
      onionEnabled: true,
      paletteId: "p1",
    });

    expect(resolved).toEqual({
      ...BUILT_IN_DEFAULTS,
      gridEnabled: false,
      checkerSize: 4,
      onionEnabled: true,
      paletteId: "p1",
    });
  });

  it("keeps every valid field", () => {
    const stored = {
      tileSize: 32,
      spriteColumns: 3,
      spriteRows: 1,
      gridEnabled: false,
      gridSize: 8,
      checkerSize: 2,
      previewFps: 12,
      paletteId: null,
      onionEnabled: true,
      onionDirection: "after",
      onionOpacity: 0.5,
    };
    expect(resolveDefaults(stored)).toEqual(stored);
  });

  it("caps columns and rows by the tile", () => {
    expect(validDefaults({ tileSize: 64, spriteColumns: 9, spriteRows: 8 })).toEqual({
      tileSize: 64,
      spriteRows: 8,
    });
  });
});
