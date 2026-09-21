import { describe, expect, it } from "vitest";
import { sortColorsByHue } from "@/lib/paletteSort";

describe("sortColorsByHue", () => {
  it("puts neutrals first, dark to light", () => {
    const sorted = sortColorsByHue(["#ffffff", "#000000", "#808080"]);
    expect(sorted).toEqual(["#000000", "#808080", "#ffffff"]);
  });

  it("groups a hue with its shades and ramps light to dark within the band", () => {
    const sorted = sortColorsByHue(["#ff8080", "#800000", "#ff0000", "#0000ff"]);
    const redBand = sorted.filter((hex) => hex !== "#0000ff");
    // #ff8080 and #ff0000 tie on value (both v=1); the paler #ff8080 (lower saturation) leads,
    // then the vivid #ff0000, then the dark #800000.
    expect(redBand).toEqual(["#ff8080", "#ff0000", "#800000"]);
    // The unrelated blue is not interleaved into the red band.
    expect(sorted.indexOf("#0000ff")).not.toBe(-1);
    expect(sorted.slice(0, 3)).toEqual(redBand);
  });

  it("puts a color's brighter self before its darker, muted variant", () => {
    // Same hue bucket (~28°), but #de6900 is brighter (v≈0.87) than #c15c02 (v≈0.76) — the
    // brighter one should lead, with the semi-transparent duplicate trailing its opaque twin.
    const sorted = sortColorsByHue(["#de6900", "#c15c02", "#c15c02ba"]);
    expect(sorted).toEqual(["#de6900", "#c15c02", "#c15c02ba"]);
  });

  it("treats a muted, low-saturation tone as neutral rather than a hue", () => {
    // #757161 (s≈0.17) is one of DawnBringer 16's slate-brown tones — barely tinted, and meant
    // to read as gray rather than land in the yellow/olive hue band.
    const sorted = sortColorsByHue(["#ff0000", "#757161", "#000000"]);
    expect(sorted).toEqual(["#000000", "#757161", "#ff0000"]);
  });

  it("keeps reds on either side of hue 0 in the same bucket", () => {
    const sorted = sortColorsByHue(["#ff0011", "#ff1100"]);
    // Both land in the wrap-around red bucket, ordered only by value/saturation/hex — not split
    // to opposite ends of the palette.
    expect(sorted).toEqual(["#ff0011", "#ff1100"]);
  });

  it("collapses duplicate hex values", () => {
    expect(sortColorsByHue(["#ff0000", "#ff0000", "#00ff00"])).toHaveLength(2);
  });

  it("handles empty and single-color input", () => {
    expect(sortColorsByHue([])).toEqual([]);
    expect(sortColorsByHue(["#123456"])).toEqual(["#123456"]);
  });
});
