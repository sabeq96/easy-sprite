import { beforeEach, describe, expect, it } from "vitest";
import { TOOL_KEY_HOLD_MS } from "@/constants/shortcuts";
import { useToolboxStore } from "@/editor/toolbox/store";
import { resetEditorStores } from "@test/store";

beforeEach(() => resetEditorStores());

describe("toolbox store: tools", () => {
  it("tapping a tool key switches for good", () => {
    useToolboxStore.getState().holdToolKey("eraser", "KeyE", 0);
    expect(useToolboxStore.getState().toolId).toBe("eraser");

    useToolboxStore.getState().releaseToolKey("KeyE", TOOL_KEY_HOLD_MS - 1);

    expect(useToolboxStore.getState()).toMatchObject({ toolId: "eraser", heldTool: null });
  });

  it("holding a tool key past the threshold hands back the tool from before it", () => {
    useToolboxStore.getState().holdToolKey("eraser", "KeyE", 0);
    useToolboxStore.getState().releaseToolKey("KeyE", TOOL_KEY_HOLD_MS);
    expect(useToolboxStore.getState()).toMatchObject({ toolId: "pencil", heldTool: null });
  });

  it("a second key takes over a hold, and quick overlapping taps end on it", () => {
    useToolboxStore.getState().holdToolKey("eraser", "KeyE", 0);
    useToolboxStore.getState().holdToolKey("bucket", "KeyB", 50);
    useToolboxStore.getState().releaseToolKey("KeyE", 80);
    expect(useToolboxStore.getState().toolId).toBe("bucket");

    useToolboxStore.getState().releaseToolKey("KeyB", 120);
    expect(useToolboxStore.getState()).toMatchObject({ toolId: "bucket", heldTool: null });
  });

  it("chained holds hand back the tool from before the first key", () => {
    useToolboxStore.getState().holdToolKey("eraser", "KeyE", 0);
    useToolboxStore.getState().holdToolKey("bucket", "KeyB", 400);
    useToolboxStore.getState().releaseToolKey("KeyE", 500);
    expect(useToolboxStore.getState().toolId).toBe("bucket");

    useToolboxStore.getState().releaseToolKey("KeyB", 900);
    expect(useToolboxStore.getState()).toMatchObject({ toolId: "pencil", heldTool: null });
  });

  it("ignores the release of a key that is not holding the tool", () => {
    useToolboxStore.getState().holdToolKey("eraser", "KeyE", 0);
    useToolboxStore.getState().releaseToolKey("KeyQ", 1000);
    expect(useToolboxStore.getState().heldTool).toMatchObject({ code: "KeyE" });
  });

  it("dropHeldTool hands back the tool whatever the time", () => {
    useToolboxStore.getState().holdToolKey("eraser", "KeyE", 0);
    useToolboxStore.getState().dropHeldTool();
    expect(useToolboxStore.getState()).toMatchObject({ toolId: "pencil", heldTool: null });
  });

  it("setTool mid-hold wins, and the pending release does nothing", () => {
    useToolboxStore.getState().holdToolKey("eraser", "KeyE", 0);
    useToolboxStore.getState().setTool("bucket");
    useToolboxStore.getState().releaseToolKey("KeyE", 1000);
    expect(useToolboxStore.getState()).toMatchObject({ toolId: "bucket", heldTool: null });
  });
});

describe("toolbox store: settings", () => {
  it("starts empty: every tool reads its declared defaults", () => {
    expect(useToolboxStore.getState().settings).toEqual({});
  });

  it("stores a value under its tool and key, leaving other tools alone", () => {
    useToolboxStore.getState().setSetting("pencil", "size", 4);
    useToolboxStore.getState().setSetting("pencil", "mirrorHorizontal", true);
    useToolboxStore.getState().setSetting("eraser", "size", 2);

    expect(useToolboxStore.getState().settings).toEqual({
      pencil: { size: 4, mirrorHorizontal: true },
      eraser: { size: 2 },
    });
  });

  it("replaces the records it changes, so selectors see a new reference", () => {
    useToolboxStore.getState().setSetting("eraser", "size", 2);
    const before = useToolboxStore.getState().settings;

    useToolboxStore.getState().setSetting("pencil", "size", 3);

    expect(useToolboxStore.getState().settings).not.toBe(before);
    expect(useToolboxStore.getState().settings.eraser).toBe(before.eraser);
  });

  it("keeps settings through tool switches", () => {
    useToolboxStore.getState().setSetting("pencil", "mirrorHorizontal", true);

    useToolboxStore.getState().setTool("eraser");
    useToolboxStore.getState().setTool("pencil");

    expect(useToolboxStore.getState().settings.pencil).toEqual({ mirrorHorizontal: true });
  });
});
