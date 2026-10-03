import { beforeEach, describe, expect, it } from "vitest";
import { useViewStore } from "@/editor/view/store";
import { resetEditorStores } from "@test/store";

beforeEach(() => resetEditorStores());

describe("view store", () => {
  it("fits the sprite to the largest zoom level that leaves room for padding", () => {
    useViewStore.getState().fitToContainer({ width: 500, height: 500 }, { width: 32, height: 32 });
    // available = 500 - 24*2 = 452; 452/32 = 14.1 → the ladder floors to 12, not 16.
    expect(useViewStore.getState().viewport).toEqual({ scale: 12, originX: 58, originY: 58 });
  });

  it("zoom steps to the next ladder level once a container size is known", () => {
    useViewStore.getState().fitToContainer({ width: 500, height: 500 }, { width: 32, height: 32 });
    const fitted = useViewStore.getState().viewport;

    useViewStore.getState().zoom({ x: 250, y: 250 }, 1, { width: 32, height: 32 });
    expect(useViewStore.getState().viewport.scale).toBeGreaterThan(fitted.scale);
  });

  it("toggleGrid flips gridEnabled and setGridEnabled sets it directly", () => {
    const initial = useViewStore.getState().gridEnabled;
    useViewStore.getState().toggleGrid();
    expect(useViewStore.getState().gridEnabled).toBe(!initial);

    useViewStore.getState().setGridEnabled(true);
    expect(useViewStore.getState().gridEnabled).toBe(true);
  });

  it("panBy offsets the viewport origin without touching scale", () => {
    const before = useViewStore.getState().viewport;
    useViewStore.getState().panBy(10, -5, { width: 32, height: 32 });
    const after = useViewStore.getState().viewport;
    expect(after).toEqual({ ...before, originX: before.originX + 10, originY: before.originY - 5 });
  });

  it("panBy leaves a sprite that fits centred", () => {
    const sprite = { width: 32, height: 32 };
    useViewStore.getState().fitToContainer({ width: 500, height: 500 }, sprite);

    useViewStore.getState().panBy(100, -100, sprite);

    expect(useViewStore.getState().viewport).toEqual({ scale: 12, originX: 58, originY: 58 });
  });

  it("panBy stops 24px past the edge once the sprite overflows", () => {
    const sprite = { width: 32, height: 32 };
    useViewStore.getState().fitToContainer({ width: 500, height: 500 }, sprite);
    useViewStore.getState().zoomByFactor({ x: 250, y: 250 }, 2, sprite);

    useViewStore.getState().panBy(10_000, -10_000, sprite);

    // scale 24: 32 × 24 = 768 px, so the origin ranges over [500 − 768 − 24, 24] = [−292, 24].
    expect(useViewStore.getState().viewport).toEqual({ scale: 24, originX: 24, originY: -292 });
  });

  it("zoomByFactor multiplies the scale and stops at the ladder's ends", () => {
    const sprite = { width: 32, height: 32 };
    useViewStore.getState().fitToContainer({ width: 500, height: 500 }, sprite);

    useViewStore.getState().zoomByFactor({ x: 250, y: 250 }, 1.1, sprite);
    expect(useViewStore.getState().viewport.scale).toBeCloseTo(13.2);

    useViewStore.getState().zoomByFactor({ x: 250, y: 250 }, 100, sprite);
    expect(useViewStore.getState().viewport.scale).toBe(48);
    useViewStore.getState().zoomByFactor({ x: 250, y: 250 }, 0.0001, sprite);
    expect(useViewStore.getState().viewport.scale).toBe(0.5);
  });

  it("a resized container re-centres a sprite that fits", () => {
    const sprite = { width: 32, height: 32 };
    useViewStore.getState().fitToContainer({ width: 500, height: 500 }, sprite);

    useViewStore.getState().setContainerSize({ width: 700, height: 600 }, sprite);

    // 32 × 12 = 384 px: (700 − 384) / 2 = 158, (600 − 384) / 2 = 108.
    expect(useViewStore.getState().viewport).toEqual({ scale: 12, originX: 158, originY: 108 });
  });

  it("resetGrid sets the grid and the chessboard to the given sizes", () => {
    useViewStore.getState().setCheckerSize(8);
    useViewStore.getState().resetGrid(16, 2);
    expect(useViewStore.getState().gridSize).toBe(16);
    expect(useViewStore.getState().checkerSize).toBe(2);
  });
});
