import { describe, expect, it } from "vitest";
import { createBuffer, getPixel, setPixel } from "@/core/buffer";
import { getClipboard, hasClipboard, pasteRect, setClipboard } from "@/tools/select/clipboard";
import { liftRegion, stampRegion, type PixelGrid } from "@/tools/select/region";
import { BLUE, RED } from "@test/factories";

/** A blank 4×4 grid. */
function makeGrid(): PixelGrid {
  return { pixels: createBuffer(4, 4), width: 4, height: 4 };
}

describe("lift and stamp", () => {
  it("cuts the source and stamps it elsewhere", () => {
    const grid = makeGrid();
    setPixel(grid.pixels, 0, 0, 4, RED);

    const lifted = liftRegion(grid, { x: 0, y: 0, w: 2, h: 2 }, true);
    expect(getPixel(grid.pixels, 0, 0, 4).a).toBe(0);

    stampRegion(grid, lifted, { x: 2, y: 2 });
    expect(getPixel(grid.pixels, 2, 2, 4)).toEqual(RED);
  });

  it("leaves the source intact when copying", () => {
    const grid = makeGrid();
    setPixel(grid.pixels, 1, 1, 4, RED);

    liftRegion(grid, { x: 1, y: 1, w: 1, h: 1 }, false);

    expect(getPixel(grid.pixels, 1, 1, 4)).toEqual(RED);
  });

  it("does not punch holes with transparent pixels when stamping", () => {
    const grid = makeGrid();
    setPixel(grid.pixels, 0, 0, 4, RED); // lifted region covers (0,0)-(1,1), only (0,0) painted
    setPixel(grid.pixels, 2, 2, 4, BLUE); // destination pixel that must survive

    const lifted = liftRegion(grid, { x: 0, y: 0, w: 2, h: 2 }, false);
    stampRegion(grid, lifted, { x: 2, y: 2 });

    expect(getPixel(grid.pixels, 2, 2, 4)).toEqual(RED); // opaque pixel overwrote it
    expect(getPixel(grid.pixels, 3, 3, 4).a).toBe(0); // transparent pixel wrote nothing
  });

  it("lifts transparent pixels from an empty grid", () => {
    const lifted = liftRegion(makeGrid(), { x: 0, y: 0, w: 2, h: 2 }, true);

    expect(lifted.pixels.every((value) => value === 0)).toBe(true);
  });

  it("clamps a stamp that runs off the edge", () => {
    const grid = makeGrid();
    setPixel(grid.pixels, 0, 0, 4, RED);

    const lifted = liftRegion(grid, { x: 0, y: 0, w: 2, h: 2 }, false);

    expect(stampRegion(grid, lifted, { x: 3, y: 3 })).toEqual({ x: 3, y: 3, w: 1, h: 1 });
    expect(stampRegion(grid, lifted, { x: 9, y: 9 })).toBeNull();
  });
});

describe("clipboard", () => {
  it("keeps its own copy of the pixels", () => {
    const pixels = new Uint8ClampedArray([12, 34, 56, 200]);
    setClipboard({ rect: { x: 2, y: 2, w: 1, h: 1 }, pixels });
    pixels[0] = 0;

    expect(hasClipboard()).toBe(true);
    expect([...getClipboard()!.pixels]).toEqual([12, 34, 56, 200]);
  });

  it("pastes at the original position", () => {
    const clip = { rect: { x: 1, y: 2, w: 2, h: 2 }, pixels: createBuffer(2, 2) };
    expect(pasteRect(clip, 4, 4)).toEqual({ x: 1, y: 2, w: 2, h: 2 });
  });

  it("nudges a paste in-bounds when it would overflow", () => {
    const clip = { rect: { x: 3, y: 3, w: 2, h: 2 }, pixels: createBuffer(2, 2) };
    expect(pasteRect(clip, 4, 4)).toEqual({ x: 2, y: 2, w: 2, h: 2 });
  });

  it("refuses a clip bigger than the canvas", () => {
    const clip = { rect: { x: 0, y: 0, w: 5, h: 1 }, pixels: createBuffer(5, 1) };
    expect(pasteRect(clip, 4, 4)).toBeNull();
  });
});
