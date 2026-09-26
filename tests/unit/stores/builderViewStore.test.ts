import { beforeEach, describe, expect, it } from "vitest";
import { BUILDER_ZOOM_LEVELS, DEFAULT_BUILDER_ZOOM } from "@/constants/builder";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";

const store = () => useBuilderViewStore.getState();

describe("builder view store", () => {
  beforeEach(() => {
    useBuilderViewStore.setState(useBuilderViewStore.getInitialState(), true);
  });

  it("opens at the default zoom with the grid on", () => {
    expect(store().zoom).toBe(DEFAULT_BUILDER_ZOOM);
    expect(store().gridEnabled).toBe(true);
  });

  it("steps along the zoom ladder and stops at either end", () => {
    store().zoomBy(1);
    expect(store().zoom).toBe(6);

    for (let step = 0; step < 10; step += 1) store().zoomBy(-1);
    expect(store().zoom).toBe(BUILDER_ZOOM_LEVELS[0]);

    for (let step = 0; step < 10; step += 1) store().zoomBy(1);
    expect(store().zoom).toBe(BUILDER_ZOOM_LEVELS.at(-1));
  });

  it("fits to the largest ladder step at which the sheet still fits the panel", () => {
    store().setContainerSize({ width: 500, height: 300 });
    // 500/96 ≈ 5.2 and 300/48 = 6.25 → the tighter axis allows 5.2 → the ladder floors to 4.
    store().fit({ width: 96, height: 48 });
    expect(store().zoom).toBe(4);
  });

  it("fits an empty sheet back to the default zoom", () => {
    store().zoomBy(1);
    store().setContainerSize({ width: 500, height: 300 });
    store().fit({ width: 0, height: 0 });
    expect(store().zoom).toBe(DEFAULT_BUILDER_ZOOM);
  });

  it("toggles the grid and switches its size", () => {
    store().toggleGrid();
    expect(store().gridEnabled).toBe(false);
    store().setGridSize(8);
    expect(store().gridSize).toBe(8);
  });

  it("resetGrid sets the grid to the sheet's tile and the chessboard back to 1px", () => {
    store().setCheckerSize(8);
    store().resetGrid(24);
    expect(store().gridSize).toBe(24);
    expect(store().checkerSize).toBe(1);
  });

  it("zooms up to 12×", () => {
    expect(BUILDER_ZOOM_LEVELS.at(-1)).toBe(12);
  });
});
