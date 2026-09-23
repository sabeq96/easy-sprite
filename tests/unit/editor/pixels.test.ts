import { describe, expect, it } from "vitest";
import { createBuffer, getPixel, setPixel } from "@/editor/buffer";
import {
  brushBounds,
  colorDistance,
  floodFill,
  forEachBrushPixel,
  forEachLinePixel,
  pickColor,
} from "@/editor/pixels";
import { BLUE, RED } from "@test/factories";

function target(width: number, height: number) {
  return { buffer: createBuffer(width, height), width, height };
}

describe("brush", () => {
  it("is top-left biased for even sizes", () => {
    expect(brushBounds(5, 5, 1)).toEqual({ x: 5, y: 5, w: 1, h: 1 });
    expect(brushBounds(5, 5, 2)).toEqual({ x: 5, y: 5, w: 2, h: 2 });
    expect(brushBounds(5, 5, 3)).toEqual({ x: 4, y: 4, w: 3, h: 3 });
    expect(brushBounds(5, 5, 4)).toEqual({ x: 4, y: 4, w: 4, h: 4 });
  });

  it("stamps size² pixels", () => {
    const seen: string[] = [];
    forEachBrushPixel(1, 1, 2, (x, y) => seen.push(`${x},${y}`));
    expect(seen).toEqual(["1,1", "2,1", "1,2", "2,2"]);
  });
});

describe("line", () => {
  it("joins two points with no gaps", () => {
    const seen: string[] = [];
    forEachLinePixel(0, 0, 3, 1, (x, y) => seen.push(`${x},${y}`));
    expect(seen).toEqual(["0,0", "1,0", "2,1", "3,1"]);
  });

  it("handles a single point and reversed direction", () => {
    const single: string[] = [];
    forEachLinePixel(2, 2, 2, 2, (x, y) => single.push(`${x},${y}`));
    expect(single).toEqual(["2,2"]);

    const reversed: string[] = [];
    forEachLinePixel(3, 0, 0, 0, (x, y) => reversed.push(`${x},${y}`));
    expect(reversed).toEqual(["3,0", "2,0", "1,0", "0,0"]);
  });
});

describe("floodFill", () => {
  it("fills a bounded region without crossing a wall", () => {
    const area = target(4, 4);
    // Vertical wall down column 2.
    for (let y = 0; y < 4; y++) setPixel(area.buffer, 2, y, 4, BLUE);

    const dirty = floodFill(area, 0, 0, RED);

    expect(dirty).toEqual({ x: 0, y: 0, w: 2, h: 4 });
    expect(getPixel(area.buffer, 1, 3, 4)).toEqual(RED);
    expect(getPixel(area.buffer, 3, 0, 4)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("does not leak diagonally", () => {
    const area = target(3, 3);
    setPixel(area.buffer, 1, 0, 3, BLUE);
    setPixel(area.buffer, 0, 1, 3, BLUE);

    floodFill(area, 0, 0, RED);

    expect(getPixel(area.buffer, 0, 0, 3)).toEqual(RED);
    expect(getPixel(area.buffer, 1, 1, 3)).not.toEqual(RED);
  });

  it("returns null when filling with the colour already there", () => {
    const area = target(2, 2);
    expect(floodFill(area, 0, 0, { r: 0, g: 0, b: 0, a: 0 })).toBeNull();
  });

  it("only fills pixels that match the seed colour exactly", () => {
    const area = target(2, 1);
    setPixel(area.buffer, 0, 0, 2, { r: 100, g: 100, b: 100, a: 255 });
    setPixel(area.buffer, 1, 0, 2, { r: 110, g: 100, b: 100, a: 255 });

    floodFill(area, 0, 0, RED);
    expect(getPixel(area.buffer, 1, 0, 2)).not.toEqual(RED);
  });

  it("fills every matching pixel when non-contiguous", () => {
    const area = target(3, 1);
    setPixel(area.buffer, 1, 0, 3, BLUE);

    floodFill(area, 0, 0, RED, { contiguous: false });

    expect(getPixel(area.buffer, 0, 0, 3)).toEqual(RED);
    expect(getPixel(area.buffer, 2, 0, 3)).toEqual(RED);
    expect(getPixel(area.buffer, 1, 0, 3)).toEqual(BLUE);
  });

  it("ignores a click outside the canvas", () => {
    expect(floodFill(target(2, 2), 5, 5, RED)).toBeNull();
  });

  it("completes on a large canvas without recursing", () => {
    const area = target(256, 256);
    const dirty = floodFill(area, 0, 0, RED);
    expect(dirty).toEqual({ x: 0, y: 0, w: 256, h: 256 });
  });
});

describe("colour sampling", () => {
  it("measures max-channel distance", () => {
    expect(colorDistance(RED, BLUE)).toBe(255);
    expect(colorDistance(RED, RED)).toBe(0);
  });

  it("returns null outside the canvas", () => {
    const area = target(2, 2);
    expect(pickColor(area, 0, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(pickColor(area, 2, 0)).toBeNull();
  });
});
