import { describe, expect, it } from "vitest";
import {
  clampViewport,
  fitViewport,
  isInsideSprite,
  screenToSprite,
  spriteToScreen,
  zoomAt,
  zoomStep,
} from "@/editor/viewport";

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

  it("clamps panning so the sprite stays reachable", () => {
    const container = { width: 400, height: 400 };
    const sprite = { width: 32, height: 32 };
    const panned = clampViewport(
      { scale: 8, originX: 99999, originY: -99999 },
      container,
      sprite,
    );
    expect(panned.originX).toBeLessThan(container.width);
    expect(panned.originY).toBeGreaterThan(-sprite.height * 8);
  });

  it("tests sprite bounds exclusively at the far edge", () => {
    const sprite = { width: 4, height: 4 };
    expect(isInsideSprite({ x: 3, y: 3 }, sprite)).toBe(true);
    expect(isInsideSprite({ x: 4, y: 0 }, sprite)).toBe(false);
  });
});
