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

  it("panBy stops once only a margin of the sprite is left on screen", () => {
    const sprite = { width: 32, height: 32 };
    useViewStore.getState().fitToContainer({ width: 500, height: 500 }, sprite);

    useViewStore.getState().panBy(10_000, -10_000, sprite);

    // scale 12: margin = min(32 * 12 * 0.25, 500 * 0.4) = 96 px of sprite kept in view.
    expect(useViewStore.getState().viewport).toEqual({ scale: 12, originX: 500 - 96, originY: -32 * 12 + 96 });
  });

  it("resetGrid sets the grid to the given tile and the chessboard back to 1px", () => {
    useViewStore.getState().setCheckerSize(8);
    useViewStore.getState().resetGrid(16);
    expect(useViewStore.getState().gridSize).toBe(16);
    expect(useViewStore.getState().checkerSize).toBe(1);
  });
});
