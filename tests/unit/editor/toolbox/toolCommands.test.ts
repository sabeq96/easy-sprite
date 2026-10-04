import { describe, expect, it } from "vitest";
import { useToolboxStore } from "@/editor/toolbox/store";
import { bindCommands } from "@/editor/module";
import { reselectLabel, TOOL_COMMANDS } from "@/editor/toolbox/toolCommands";
import { getTool } from "@/tools";
import { moduleContext } from "@test/modules";
import { resetEditorStores } from "@test/store";

function setup() {
  resetEditorStores();
  return { store: useToolboxStore, commands: bindCommands(TOOL_COMMANDS, moduleContext()) };
}

describe("tool commands", () => {
  it("pressing the active pencil's key again cycles only the pencil's size and holds nothing", () => {
    const { store, commands } = setup();

    commands["tool.pencil"]?.hold?.press({ code: "KeyP", at: 0 });

    expect(store.getState().settings).toEqual({ pencil: { size: 2 } });
    expect(store.getState().heldTool).toBeNull();
  });

  it("pressing the active eraser's key again cycles only the eraser's size and holds nothing", () => {
    const { store, commands } = setup();
    store.getState().setTool("eraser");
    store.getState().setSetting("pencil", "size", 4);

    commands["tool.eraser"]?.hold?.press({ code: "KeyE", at: 0 });

    expect(store.getState()).toMatchObject({ toolId: "eraser", heldTool: null });
    expect(store.getState().settings).toEqual({ pencil: { size: 4 }, eraser: { size: 2 } });
  });

  it("pressing it again from the largest size wraps to the smallest", () => {
    const { store, commands } = setup();
    store.getState().setSetting("pencil", "size", 8);

    commands["tool.pencil"]?.hold?.press({ code: "KeyP", at: 0 });

    expect(store.getState().settings.pencil).toEqual({ size: 1 });
  });

  it("pressing the active select tool's key again cycles Rectangle → Lasso → Rectangle without holding", () => {
    const { store, commands } = setup();
    store.getState().setTool("select");

    commands["tool.select"]?.hold?.press({ code: "KeyS", at: 0 });
    expect(store.getState().settings).toEqual({ select: { shape: "lasso" } });
    expect(store.getState().heldTool).toBeNull();

    commands["tool.select"]?.hold?.press({ code: "KeyS", at: 1 });
    expect(store.getState().settings.select).toEqual({ shape: "rectangle" });
  });

  it("pressing the active picker's key again does nothing", () => {
    const { store, commands } = setup();
    store.getState().setTool("picker");

    commands["tool.picker"]?.hold?.press({ code: "KeyO", at: 0 });

    expect(store.getState()).toMatchObject({ toolId: "picker", heldTool: null, settings: {} });
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

  it("names the press-again row after the setting it cycles", () => {
    expect(reselectLabel(getTool("pencil"))).toBe("Cycle brush size");
    expect(reselectLabel(getTool("eraser"))).toBe("Cycle brush size");
    expect(reselectLabel(getTool("select"))).toBe("Cycle shape");
    expect(reselectLabel(getTool("picker"))).toBeNull();
  });
});
