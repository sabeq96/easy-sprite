import { describe, expect, it } from "vitest";
import { createTestStore } from "@test/store";

const SIZE = { width: 8, height: 8 };

describe("selectionSlice", () => {
  it("setSelectionRect creates a selection with a matching mask", () => {
    const store = createTestStore();
    store.getState().setSelectionRect({ x: 1, y: 1, w: 2, h: 2 }, SIZE);

    const { selection, selectionMask, pendingRect } = store.getState();
    expect(selection?.rect).toEqual({ x: 1, y: 1, w: 2, h: 2 });
    expect(selectionMask).toBe(selection?.mask);
    expect(pendingRect).toBeNull();
  });

  it("clamps a rect that overhangs the sprite", () => {
    const store = createTestStore();
    store.getState().setSelectionRect({ x: 6, y: 6, w: 10, h: 10 }, SIZE);
    expect(store.getState().selection?.rect).toEqual({ x: 6, y: 6, w: 2, h: 2 });
  });

  it("selectAllPixels selects every pixel in the sprite", () => {
    const store = createTestStore();
    store.getState().selectAllPixels(SIZE);
    const { selection, selectionMask } = store.getState();
    expect(selection?.rect).toEqual({ x: 0, y: 0, w: 8, h: 8 });
    expect(selectionMask?.every((byte) => byte === 1)).toBe(true);
  });

  it("clearSelection resets selection, mask and pendingRect together", () => {
    const store = createTestStore();
    store.getState().selectAllPixels(SIZE);
    store.getState().setPendingRect({ x: 0, y: 0, w: 1, h: 1 });

    store.getState().clearSelection();
    expect(store.getState()).toMatchObject({
      selection: null,
      selectionMask: null,
      pendingRect: null,
    });
  });

  it("setPendingRect tracks a live drag without committing a selection", () => {
    const store = createTestStore();
    store.getState().setPendingRect({ x: 2, y: 2, w: 3, h: 3 });
    expect(store.getState().pendingRect).toEqual({ x: 2, y: 2, w: 3, h: 3 });
    expect(store.getState().selection).toBeNull();
  });
});
