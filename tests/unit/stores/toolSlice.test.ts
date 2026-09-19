import { describe, expect, it } from "vitest";
import { createTestStore } from "@test/store";

describe("toolSlice", () => {
  it("setTool clears any held temporary tool", () => {
    const store = createTestStore();
    store.getState().pushTemporaryTool("picker");
    store.getState().setTool("bucket");
    expect(store.getState()).toMatchObject({ toolId: "bucket", previousToolId: null });
  });

  it("pushTemporaryTool remembers the tool it replaced and popTemporaryTool restores it", () => {
    const store = createTestStore();
    store.getState().setTool("pencil");
    store.getState().pushTemporaryTool("picker");
    expect(store.getState().toolId).toBe("picker");
    expect(store.getState().previousToolId).toBe("pencil");

    store.getState().popTemporaryTool();
    expect(store.getState()).toMatchObject({ toolId: "pencil", previousToolId: null });
  });

  it("a second pushTemporaryTool while one is already held is a no-op", () => {
    const store = createTestStore();
    store.getState().setTool("pencil");
    store.getState().pushTemporaryTool("picker");
    store.getState().pushTemporaryTool("eraser");
    expect(store.getState()).toMatchObject({ toolId: "picker", previousToolId: "pencil" });
  });

  it("setTool clears mirroring, which only the pencil applies", () => {
    const store = createTestStore();
    store.getState().setToolOptions({ mirrorHorizontal: true, mirrorVertical: true });

    store.getState().setTool("eraser");

    expect(store.getState().toolOptions).toMatchObject({
      mirrorHorizontal: false,
      mirrorVertical: false,
    });
  });

  it("setTool leaves other tool options alone", () => {
    const store = createTestStore();
    store.getState().setToolOptions({ brushSize: 3, mirrorHorizontal: true });

    store.getState().setTool("eraser");

    expect(store.getState().toolOptions).toMatchObject({ brushSize: 3, pickFromComposite: true });
  });

  it("re-selecting the tool already in use keeps mirroring on", () => {
    const store = createTestStore();
    store.getState().setTool("pencil");
    store.getState().setToolOptions({ mirrorHorizontal: true });

    store.getState().setTool("pencil");

    expect(store.getState().toolOptions.mirrorHorizontal).toBe(true);
  });

  it("a held modifier tool keeps mirroring for the tool it returns to", () => {
    const store = createTestStore();
    store.getState().setTool("pencil");
    store.getState().setToolOptions({ mirrorHorizontal: true });

    store.getState().pushTemporaryTool("picker");
    store.getState().popTemporaryTool();

    expect(store.getState()).toMatchObject({ toolId: "pencil" });
    expect(store.getState().toolOptions.mirrorHorizontal).toBe(true);
  });

  it("a selection survives switching tools, including away from the select tool", () => {
    // Selection is canvas geometry, not tool state: only a resize or leaving the sprite drops
    // it. Resetting tool options on switch must never reach it.
    const store = createTestStore();
    store.getState().setTool("select");
    store.getState().selectAllPixels({ width: 4, height: 4 });
    const mask = store.getState().selectionMask;

    store.getState().setTool("pencil");
    expect(store.getState().selectionMask).toBe(mask);

    store.getState().setTool("bucket");
    expect(store.getState().selection).not.toBeNull();
    expect(store.getState().selectionMask).toBe(mask);
  });

  it("cycleBrushSize wraps back to 1 after the cycle cap", () => {
    const store = createTestStore();
    const sizes = [1, 2, 3, 4].map(() => {
      store.getState().cycleBrushSize();
      return store.getState().toolOptions.brushSize;
    });
    expect(sizes).toEqual([2, 3, 4, 1]);
  });

  it("setToolOptions merges a partial patch", () => {
    const store = createTestStore();
    store.getState().setToolOptions({ mirrorHorizontal: true });
    expect(store.getState().toolOptions).toMatchObject({ mirrorHorizontal: true, brushSize: 1 });
  });
});
