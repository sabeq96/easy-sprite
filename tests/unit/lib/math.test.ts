import { describe, expect, it } from "vitest";
import { clamp, snapToLadder, stepLadder } from "@/lib/math";
import { ZOOM_LEVELS } from "@/constants/canvas";

describe("math helpers", () => {
  it("clamps to the range", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it("snaps to the nearest ladder entry", () => {
    expect(snapToLadder(7, ZOOM_LEVELS)).toBe(6);
    expect(snapToLadder(100, ZOOM_LEVELS)).toBe(32);
  });

  it("steps along the ladder and stops at the ends", () => {
    expect(stepLadder(8, ZOOM_LEVELS, 1)).toBe(12);
    expect(stepLadder(8, ZOOM_LEVELS, -1)).toBe(6);
    expect(stepLadder(32, ZOOM_LEVELS, 1)).toBe(32);
    expect(stepLadder(0.5, ZOOM_LEVELS, -1)).toBe(0.5);
  });
});
