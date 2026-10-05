import { describe, expect, it } from "vitest";
import { forEachLinePixel } from "@/core/pixels";
import type { Point } from "@/core/viewport";
import { constrain, forEachShapePixel, type ShapeKind } from "@/tools/shape/shapes";

/** Every written pixel as "x,y", in write order (duplicates kept, so tests can catch them). */
function written(kind: ShapeKind, from: Point, to: Point, filled = false): string[] {
  const out: string[] = [];
  forEachShapePixel(kind, from, to, filled, (x, y) => out.push(`${x},${y}`));
  return out;
}

function box(w: number, h: number): [Point, Point] {
  return [{ x: 0, y: 0 }, { x: w - 1, y: h - 1 }];
}

function parse(key: string): Point {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

/** True when every pixel reaches every other through its 8 neighbours. */
function connected(keys: string[]): boolean {
  const all = new Set(keys);
  const seen = new Set([keys[0]]);
  const queue = [keys[0]];
  while (queue.length) {
    const { x, y } = parse(queue.pop()!);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const next = `${x + dx},${y + dy}`;
        if (all.has(next) && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
  }
  return seen.size === all.size;
}

describe("rectangle", () => {
  it("draws a 1×1 box as one pixel", () => {
    expect(written("rectangle", ...box(1, 1))).toEqual(["0,0"]);
  });

  it("draws a 2×2 box as all four pixels", () => {
    expect(written("rectangle", ...box(2, 2)).sort()).toEqual(["0,0", "0,1", "1,0", "1,1"]);
  });

  it("outlines a 4×3 box without its inside, each pixel once", () => {
    const pixels = written("rectangle", ...box(4, 3));
    expect(pixels).toHaveLength(10);
    expect(new Set(pixels).size).toBe(10);
    expect(pixels).not.toContain("1,1");
    expect(pixels).not.toContain("2,1");
  });

  it("fills every pixel of the box when filled", () => {
    expect(written("rectangle", ...box(4, 3), true)).toHaveLength(12);
  });

  it("draws the same pixels whichever corner the drag starts from", () => {
    const forward = written("rectangle", { x: 1, y: 2 }, { x: 6, y: 5 }).sort();
    expect(written("rectangle", { x: 6, y: 5 }, { x: 1, y: 2 }).sort()).toEqual(forward);
    expect(written("rectangle", { x: 1, y: 5 }, { x: 6, y: 2 }).sort()).toEqual(forward);
  });
});

describe("ellipse", () => {
  it("draws a 1×1 box as one pixel and a 2×2 box as four", () => {
    expect(written("ellipse", ...box(1, 1))).toEqual(["0,0"]);
    expect(written("ellipse", ...box(2, 2))).toHaveLength(4);
  });

  it.each([
    [5, 3],
    [8, 8],
    [8, 2],
    [16, 5],
    [3, 11],
  ])("outlines a %i×%i box: no duplicates, symmetric, touching all sides, gap-free", (w, h) => {
    const pixels = written("ellipse", ...box(w, h));
    const set = new Set(pixels);
    expect(set.size).toBe(pixels.length);

    const points = pixels.map(parse);
    for (const { x, y } of points) {
      expect(set.has(`${w - 1 - x},${y}`)).toBe(true);
      expect(set.has(`${x},${h - 1 - y}`)).toBe(true);
    }
    expect(Math.min(...points.map((p) => p.x))).toBe(0);
    expect(Math.max(...points.map((p) => p.x))).toBe(w - 1);
    expect(Math.min(...points.map((p) => p.y))).toBe(0);
    expect(Math.max(...points.map((p) => p.y))).toBe(h - 1);
    expect(connected(pixels)).toBe(true);
  });

  it("leaves the inside of an 8×8 circle empty, and fills it when filled", () => {
    const outline = new Set(written("ellipse", ...box(8, 8)));
    const filled = written("ellipse", ...box(8, 8), true);

    expect(outline.has("4,4")).toBe(false);
    expect(filled).toContain("4,4");
    expect(new Set(filled).size).toBe(filled.length);
    for (const key of outline) expect(filled).toContain(key);
    // A circle, not the box: the corners stay empty.
    expect(filled).not.toContain("0,0");
  });
});

describe("line", () => {
  it("is the Bresenham line between the two ends and ignores Fill", () => {
    const expected: string[] = [];
    forEachLinePixel(1, 1, 7, 4, (x, y) => expected.push(`${x},${y}`));

    expect(written("line", { x: 1, y: 1 }, { x: 7, y: 4 })).toEqual(expected);
    expect(written("line", { x: 1, y: 1 }, { x: 7, y: 4 }, true)).toEqual(expected);
  });
});

describe("constrain (Shift)", () => {
  const from = { x: 5, y: 5 };

  it.each([
    [{ x: 8, y: 6 }, { x: 8, y: 8 }],
    [{ x: 2, y: 6 }, { x: 2, y: 8 }],
    [{ x: 6, y: 1 }, { x: 9, y: 1 }],
    [{ x: 4, y: 3 }, { x: 3, y: 3 }],
  ])("squares the box toward the drag: %o → %o", (to, expected) => {
    expect(constrain("rectangle", from, to)).toEqual(expected);
    expect(constrain("ellipse", from, to)).toEqual(expected);
  });

  it.each([
    [{ x: 15, y: 7 }, { x: 15, y: 5 }],
    [{ x: -5, y: 3 }, { x: -5, y: 5 }],
    [{ x: 6, y: 15 }, { x: 5, y: 15 }],
    [{ x: 4, y: -5 }, { x: 5, y: -5 }],
    [{ x: 13, y: 14 }, { x: 14, y: 14 }],
    [{ x: -4, y: 14 }, { x: -4, y: 14 }],
    [{ x: 14, y: -3 }, { x: 14, y: -4 }],
    [{ x: -3, y: -4 }, { x: -4, y: -4 }],
  ])("snaps a line to the nearest of 8 directions: %o → %o", (to, expected) => {
    expect(constrain("line", from, to)).toEqual(expected);
  });
});
