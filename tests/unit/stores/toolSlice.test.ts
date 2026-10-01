import { describe, expect, it } from "vitest";
import { TOOL_KEY_HOLD_MS } from "@/constants/shortcuts";
import { BRUSH_SIZES } from "@/constants/tools";
import { createTestStore } from "@test/store";

describe("toolSlice", () => {
  it("tapping a tool key switches for good", () => {
    const store = createTestStore();
    store.getState().holdToolKey("eraser", "KeyE", 0);
    expect(store.getState().toolId).toBe("eraser");

    store.getState().releaseToolKey("KeyE", TOOL_KEY_HOLD_MS - 1);

    expect(store.getState()).toMatchObject({ toolId: "eraser", heldTool: null });
  });

  it("holding a tool key past the threshold hands back the tool from before it", () => {
    const store = createTestStore();
    store.getState().holdToolKey("eraser", "KeyE", 0);
    store.getState().releaseToolKey("KeyE", TOOL_KEY_HOLD_MS);
    expect(store.getState()).toMatchObject({ toolId: "pencil", heldTool: null });
  });

  it("a tap clears mirroring like clicking the tool; a hold hands it back intact", () => {
    const tapped = createTestStore();
    tapped.getState().setToolOptions({ mirrorHorizontal: true });
    tapped.getState().holdToolKey("eraser", "KeyE", 0);
    tapped.getState().releaseToolKey("KeyE", 10);
    expect(tapped.getState().toolOptions.mirrorHorizontal).toBe(false);

    const held = createTestStore();
    held.getState().setToolOptions({ mirrorHorizontal: true });
    held.getState().holdToolKey("eraser", "KeyE", 0);
    held.getState().releaseToolKey("KeyE", 1000);
    expect(held.getState()).toMatchObject({ toolId: "pencil" });
    expect(held.getState().toolOptions.mirrorHorizontal).toBe(true);
  });

  it("a second key takes over a hold, and quick overlapping taps end on it", () => {
    const store = createTestStore();
    store.getState().holdToolKey("eraser", "KeyE", 0);
    store.getState().holdToolKey("bucket", "KeyB", 50);
    store.getState().releaseToolKey("KeyE", 80);
    expect(store.getState().toolId).toBe("bucket");

    store.getState().releaseToolKey("KeyB", 120);
    expect(store.getState()).toMatchObject({ toolId: "bucket", heldTool: null });
  });

  it("chained holds hand back the tool from before the first key", () => {
    const store = createTestStore();
    store.getState().holdToolKey("eraser", "KeyE", 0);
    store.getState().holdToolKey("bucket", "KeyB", 400);
    store.getState().releaseToolKey("KeyE", 500);
    expect(store.getState().toolId).toBe("bucket");

    store.getState().releaseToolKey("KeyB", 900);
    expect(store.getState()).toMatchObject({ toolId: "pencil", heldTool: null });
  });

  it("ignores the release of a key that is not holding the tool", () => {
    const store = createTestStore();
    store.getState().holdToolKey("eraser", "KeyE", 0);
    store.getState().releaseToolKey("KeyQ", 1000);
    expect(store.getState().heldTool).toMatchObject({ code: "KeyE" });
  });

  it("dropHeldTool hands back the tool whatever the time", () => {
    const store = createTestStore();
    store.getState().holdToolKey("eraser", "KeyE", 0);
    store.getState().dropHeldTool();
    expect(store.getState()).toMatchObject({ toolId: "pencil", heldTool: null });
  });

  it("setTool mid-hold wins, and the pending release does nothing", () => {
    const store = createTestStore();
    store.getState().holdToolKey("eraser", "KeyE", 0);
    store.getState().setTool("bucket");
    store.getState().releaseToolKey("KeyE", 1000);
    expect(store.getState()).toMatchObject({ toolId: "bucket", heldTool: null });
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

  it("cycleBrushSize steps through every brush size and wraps back to 1", () => {
    const store = createTestStore();
    const sizes = BRUSH_SIZES.map(() => {
      store.getState().cycleBrushSize();
      return store.getState().toolOptions.brushSize;
    });
    expect(sizes).toEqual([2, 3, 4, 6, 8, 1]);
  });

  it.each([
    [4, 6],
    [6, 8],
    [8, 1],
  ])("cycleBrushSize from %i goes to %i", (from, to) => {
    const store = createTestStore();
    store.getState().setToolOptions({ brushSize: from });
    store.getState().cycleBrushSize();
    expect(store.getState().toolOptions.brushSize).toBe(to);
  });

  it("setToolOptions merges a partial patch", () => {
    const store = createTestStore();
    store.getState().setToolOptions({ mirrorHorizontal: true });
    expect(store.getState().toolOptions).toMatchObject({ mirrorHorizontal: true, brushSize: 1 });
  });
});
