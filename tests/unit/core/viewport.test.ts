import { describe, expect, it } from "vitest";
import {
  constrainViewport,
  fitViewport,
  isInsideSprite,
  screenToSprite,
  spriteToScreen,
  wheelZoomFactor,
  zoomAt,
  zoomStep,
} from "@/core/viewport";

describe("viewport", () => {
  it("keeps the pixel under the cursor fixed while zooming", () => {
    const viewport = { scale: 4, originX: 10, originY: 10 };
    const cursor = { x: 50, y: 30 };

    const before = screenToSprite(viewport, cursor);
    const after = screenToSprite(zoomAt(viewport, cursor, 8), cursor);
    expect(after).toEqual(before);
  });

  it("maps a sprite pixel to screen and back", () => {
    const viewport = { scale: 7, originX: 3, originY: 5 };
    expect(screenToSprite(viewport, spriteToScreen(viewport, { x: 4, y: 9 }))).toEqual({
      x: 4,
      y: 9,
    });
  });

  it("floors negative coordinates instead of truncating toward zero", () => {
    const viewport = { scale: 10, originX: 0, originY: 0 };
    expect(screenToSprite(viewport, { x: -1, y: -1 })).toEqual({ x: -1, y: -1 });
  });

  it("steps along the zoom ladder", () => {
    const viewport = { scale: 8, originX: 0, originY: 0 };
    expect(zoomStep(viewport, { x: 0, y: 0 }, 1).scale).toBe(12);
    expect(zoomStep(viewport, { x: 0, y: 0 }, -1).scale).toBe(6);
  });

  it("fits a sprite centred on a ladder scale", () => {
    const viewport = fitViewport({ width: 400, height: 400 }, { width: 32, height: 32 });
    expect(viewport.scale).toBe(8);
    expect(viewport.originX).toBe(72);
    expect(viewport.originY).toBe(72);
  });

  it("never picks a scale that overflows the container", () => {
    const container = { width: 100, height: 100 };
    const sprite = { width: 128, height: 128 };
    const viewport = fitViewport(container, sprite);
    expect(sprite.width * viewport.scale).toBeLessThanOrEqual(container.width);
  });

  it("zooms by 4/3 per 120 px of wheel delta, continuously", () => {
    expect(wheelZoomFactor(-120)).toBeCloseTo(4 / 3);
    expect(wheelZoomFactor(120)).toBeCloseTo(3 / 4);
    expect(wheelZoomFactor(0)).toBe(1);
    expect(wheelZoomFactor(-10)).toBeGreaterThan(1);
  });

  it("centres an axis that fits, wherever its origin was", () => {
    const container = { width: 400, height: 400 };
    const sprite = { width: 32, height: 32 };
    // 32 × 8 = 256, + 2 × 24 padding = 304 ≤ 400 → centred at (400 − 256) / 2 = 72.
    expect(constrainViewport({ scale: 8, originX: 5, originY: 300 }, container, sprite)).toEqual({
      scale: 8,
      originX: 72,
      originY: 72,
    });
  });

  it("lets an overflowing axis scroll only until the padding shows past either edge", () => {
    const container = { width: 400, height: 400 };
    const sprite = { width: 32, height: 32 };
    // 32 × 16 = 512 > 400: origin ranges over [400 − 512 − 24, 24] = [−136, 24].
    expect(constrainViewport({ scale: 16, originX: 999, originY: -999 }, container, sprite)).toEqual({
      scale: 16,
      originX: 24,
      originY: -136,
    });
    expect(constrainViewport({ scale: 16, originX: -50, originY: 0 }, container, sprite).originX).toBe(-50);
  });

  it("constrains each axis on its own", () => {
    // A wide strip: overflows horizontally, fits vertically.
    const viewport = constrainViewport(
      { scale: 8, originX: 100, originY: 0 },
      { width: 400, height: 400 },
      { width: 64, height: 8 },
    );
    expect(viewport.originX).toBe(24);
    expect(viewport.originY).toBe(168);
  });

  it("tests sprite bounds exclusively at the far edge", () => {
    const sprite = { width: 4, height: 4 };
    expect(isInsideSprite({ x: 3, y: 3 }, sprite)).toBe(true);
    expect(isInsideSprite({ x: 4, y: 0 }, sprite)).toBe(false);
  });
});
