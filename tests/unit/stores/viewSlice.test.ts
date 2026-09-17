import { describe, expect, it } from "vitest";
import { createTestStore } from "@test/store";

describe("viewSlice", () => {
  it("fits the sprite to the largest zoom level that leaves room for padding", () => {
    const store = createTestStore();
    store.getState().fitToContainer({ width: 500, height: 500 }, { width: 32, height: 32 });
    // available = 500 - 24*2 = 452; 452/32 = 14.1 → the ladder floors to 12, not 16.
    expect(store.getState().viewport).toEqual({ scale: 12, originX: 58, originY: 58 });
  });

  it("zoom steps to the next ladder level once a container size is known", () => {
    const store = createTestStore();
    store.getState().fitToContainer({ width: 500, height: 500 }, { width: 32, height: 32 });
    const fitted = store.getState().viewport;

    store.getState().zoom({ x: 250, y: 250 }, 1, { width: 32, height: 32 });
    expect(store.getState().viewport.scale).toBeGreaterThan(fitted.scale);
  });

  it("toggleGrid flips gridEnabled and setGridEnabled sets it directly", () => {
    const store = createTestStore();
    const initial = store.getState().gridEnabled;
    store.getState().toggleGrid();
    expect(store.getState().gridEnabled).toBe(!initial);

    store.getState().setGridEnabled(true);
    expect(store.getState().gridEnabled).toBe(true);
  });

  it("panBy offsets the viewport origin without touching scale", () => {
    const store = createTestStore();
    const before = store.getState().viewport;
    store.getState().panBy(10, -5);
    const after = store.getState().viewport;
    expect(after).toEqual({ ...before, originX: before.originX + 10, originY: before.originY - 5 });
  });

  it("setOnion merges a partial patch onto the existing config", () => {
    const store = createTestStore();
    store.getState().setOnion({ enabled: true });
    expect(store.getState().onion.enabled).toBe(true);
    expect(store.getState().onion.direction).toBe("before"); // untouched fields survive the patch
  });

  it("tracks the active frame and layer", () => {
    const store = createTestStore();
    store.getState().setActiveFrame("f1");
    store.getState().setActiveLayer("l1");
    expect(store.getState().activeFrameId).toBe("f1");
    expect(store.getState().activeLayerId).toBe("l1");
  });
});
