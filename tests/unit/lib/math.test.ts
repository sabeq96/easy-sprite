import { describe, expect, it } from "vitest";
import { clamp, stepLadder } from "@/lib/math";
import { ZOOM_LEVELS } from "@/constants/canvas";

describe("math helpers", () => {
  it("clamps to the range", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it("steps along the ladder and stops at the ends", () => {
    expect(stepLadder(8, ZOOM_LEVELS, 1)).toBe(12);
    expect(stepLadder(8, ZOOM_LEVELS, -1)).toBe(6);
    expect(stepLadder(32, ZOOM_LEVELS, 1)).toBe(48);
    expect(stepLadder(48, ZOOM_LEVELS, 1)).toBe(48);
    expect(stepLadder(0.5, ZOOM_LEVELS, -1)).toBe(0.5);
  });

  it("steps from between two entries to the next one strictly above or below", () => {
    expect(stepLadder(7.3, ZOOM_LEVELS, 1)).toBe(8);
    expect(stepLadder(7.3, ZOOM_LEVELS, -1)).toBe(6);
    expect(stepLadder(9.9, ZOOM_LEVELS, -1)).toBe(8);
    expect(stepLadder(47, ZOOM_LEVELS, 1)).toBe(48);
    expect(stepLadder(0.7, ZOOM_LEVELS, -1)).toBe(0.5);
  });
});
