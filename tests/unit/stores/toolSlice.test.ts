import { describe, expect, it } from "vitest";
import { TOOL_KEY_HOLD_MS } from "@/constants/shortcuts";
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
});
