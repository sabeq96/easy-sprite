import { describe, expect, it } from "vitest";
import { boundCommand, keysOf, reselectKeys } from "@/commands/keymap";
import { bindEditorCommands } from "@/editor/modules";
import { getTool, TOOL_LIST } from "@/tools";
import { formatBinding } from "@/lib/keys";
import { moduleContext } from "@test/modules";

const registry = () => bindEditorCommands(moduleContext());

const press = (key: string, init: KeyboardEventInit = {}) => new KeyboardEvent("keydown", { key, ...init });

describe("keymap", () => {
  it("binds each tool's own shortcut to its activation command", () => {
    const commands = registry();
    for (const tool of TOOL_LIST) {
      if (tool.shortcut) expect(commands[`tool.${tool.id}`]?.keys).toEqual([tool.shortcut]);
    }
  });

  it("formats every key of a command, and none for one that is not registered", () => {
    const commands = registry();
    expect(keysOf(commands["view.zoomIn"])).toEqual([{ key: "+" }, { key: "=" }].map(formatBinding));
    expect(keysOf(commands["layer.duplicate"])).toEqual([]);
    expect(keysOf(undefined)).toEqual([]);
  });

  it("labels a tool's press-again key only when it has something to reselect", () => {
    const commands = registry();
    expect(reselectKeys(getTool("pencil"), commands)).toEqual(
      keysOf(commands["tool.pencil"]).map((key) => `${key} again`),
    );
    expect(reselectKeys(getTool("eraser"), commands)).toEqual(
      keysOf(commands["tool.eraser"]).map((key) => `${key} again`),
    );
    expect(reselectKeys(getTool("picker"), commands)).toEqual([]);
  });

  it("binds V to the mirror toggle, apart from paste", () => {
    const commands = registry();
    expect(commands["tool.toggleMirror"]?.keys).toEqual([{ key: "v" }]);
    expect(commands["edit.paste"]?.keys).toEqual([{ key: "v", mod: true }]);
  });

  it("finds the command a key press is bound to, and none for an unbound key", () => {
    const commands = registry();
    expect(boundCommand(commands, press("n"))?.id).toBe("frame.add");
    expect(boundCommand(commands, press("N", { shiftKey: true }))?.id).toBe("frame.duplicate");
    expect(boundCommand(commands, press("PageUp"))?.id).toBe("layer.selectAbove");
    expect(boundCommand(commands, press("q"))).toBeUndefined();
    expect(boundCommand({}, press("n"))).toBeUndefined();
  });
});
