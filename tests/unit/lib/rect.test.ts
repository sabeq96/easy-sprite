import { describe, expect, it } from "vitest";
import { rectClamp, rectFromPoints, rectUnion } from "@/lib/rect";

describe("rect", () => {
  it("builds an inclusive rect from two points in any order", () => {
    expect(rectFromPoints(4, 6, 2, 3)).toEqual({ x: 2, y: 3, w: 3, h: 4 });
  });

  it("unions with a null accumulator", () => {
    expect(rectUnion(null, { x: 1, y: 1, w: 2, h: 2 })).toEqual({ x: 1, y: 1, w: 2, h: 2 });
    expect(rectUnion({ x: 0, y: 0, w: 1, h: 1 }, { x: 3, y: 2, w: 1, h: 1 })).toEqual({
      x: 0, y: 0, w: 4, h: 3,
    });
  });

  it("clamps to the canvas, collapsing fully outside rects", () => {
    expect(rectClamp({ x: -2, y: -2, w: 4, h: 4 }, 8, 8)).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    expect(rectClamp({ x: 10, y: 10, w: 4, h: 4 }, 8, 8).w).toBe(0);
  });
});
