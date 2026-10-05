import { describe, expect, it } from "vitest";
import {
  hexToRgba,
  hsvToRgb,
  packRgba,
  parseHex,
  rgbToHsv,
  rgbaToHex,
  shadesOf,
  unpackRgba,
} from "@/lib/color";

describe("color", () => {
  it("round-trips hex with and without alpha", () => {
    expect(hexToRgba("#ff8800")).toEqual({ r: 255, g: 136, b: 0, a: 255 });
    expect(hexToRgba("#ff880080")).toEqual({ r: 255, g: 136, b: 0, a: 128 });
    expect(rgbaToHex({ r: 255, g: 136, b: 0, a: 128 }, true)).toBe("#ff880080");
  });

  it("expands 3-digit hex", () => {
    expect(hexToRgba("#f80")).toEqual({ r: 255, g: 136, b: 0, a: 255 });
  });

  it("rejects junk instead of throwing", () => {
    expect(parseHex("nope")).toBeNull();
    expect(parseHex("#ff88")).toBeNull();
    expect(parseHex("  #abc ")).not.toBeNull();
  });

  it("packs and unpacks losslessly", () => {
    const color = { r: 12, g: 200, b: 255, a: 77 };
    expect(unpackRgba(packRgba(color))).toEqual(color);
  });

  it("round-trips hsv", () => {
    const color = { r: 200, g: 120, b: 40, a: 255 };
    expect(hsvToRgb(rgbToHsv(color), color.a)).toEqual(color);
  });

  it("shades a color from darkest to lightest, with the color itself in the middle", () => {
    const color = { r: 200, g: 100, b: 50, a: 128 };
    const shades = shadesOf(color);
    const values = shades.map((shade) => rgbToHsv(shade).v);
    expect(shades).toHaveLength(5);
    expect(shades[2]).toEqual(color);
    expect(values[0]).toBeLessThan(values[1]);
    expect(values[1]).toBeLessThan(values[2]);
    expect(rgbToHsv(shades[4]).s).toBeLessThan(rgbToHsv(shades[3]).s);
    expect(shades.every((shade) => shade.a === 128)).toBe(true);
  });
});
