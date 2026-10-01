import { describe, expect, it } from "vitest";
import { createToolCommands } from "@/commands/toolCommands";
import { createTestStore } from "@test/store";

function setup() {
  const store = createTestStore();
  return { store, commands: createToolCommands(store) };
}

describe("tool commands", () => {
  it("pressing the active pencil's key again cycles the brush size and holds nothing", () => {
    const { store, commands } = setup();

    commands["tool.pencil"]?.hold?.press({ code: "KeyP", at: 0 });

    expect(store.getState().toolOptions.brushSize).toBe(2);
    expect(store.getState().heldTool).toBeNull();
  });

  it("pressing the active eraser's key again cycles the brush size and holds nothing", () => {
    const { store, commands } = setup();
    store.getState().setTool("eraser");

    commands["tool.eraser"]?.hold?.press({ code: "KeyE", at: 0 });

    expect(store.getState()).toMatchObject({ toolId: "eraser", heldTool: null });
    expect(store.getState().toolOptions.brushSize).toBe(2);
  });

  it("pressing the active picker's key again does nothing", () => {
    const { store, commands } = setup();
    store.getState().setTool("picker");

    commands["tool.picker"]?.hold?.press({ code: "KeyO", at: 0 });

    expect(store.getState()).toMatchObject({ toolId: "picker", heldTool: null });
    expect(store.getState().toolOptions.brushSize).toBe(1);
  });

  it("pressing another tool's key starts a hold that its release resolves", () => {
    const { store, commands } = setup();
    const eraser = commands["tool.eraser"]?.hold;

    eraser?.press({ code: "KeyE", at: 0 });
    expect(store.getState()).toMatchObject({ toolId: "eraser", heldTool: { code: "KeyE" } });

    eraser?.release({ code: "KeyE", at: 1000 });
    expect(store.getState()).toMatchObject({ toolId: "pencil", heldTool: null });
  });

  it("cancelling a press hands back the previous tool", () => {
    const { store, commands } = setup();
    commands["tool.picker"]?.hold?.press({ code: "KeyO", at: 0 });

    commands["tool.picker"]?.hold?.cancel();

    expect(store.getState().toolId).toBe("pencil");
  });

  it("toggles horizontal mirroring, only for a tool that mirrors", () => {
    const { store, commands } = setup();
    const toggle = commands["tool.toggleMirror"];

    expect(toggle?.isEnabled?.()).toBe(true);
    toggle?.run();
    expect(store.getState().toolOptions).toMatchObject({ mirrorHorizontal: true, mirrorVertical: false });
    toggle?.run();
    expect(store.getState().toolOptions.mirrorHorizontal).toBe(false);

    store.getState().setTool("eraser");
    expect(toggle?.isEnabled?.()).toBe(false);
  });
});
