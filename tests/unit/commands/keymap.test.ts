import { describe, expect, it } from "vitest";
import { commandKeys, reselectKeys, SHORTCUTS } from "@/commands/keymap";
import type { CommandId } from "@/commands/types";
import { getTool, TOOL_LIST } from "@/core/tools";
import { bindingSignature } from "@/lib/keys";

describe("keymap", () => {
  it("never binds one chord to two commands", () => {
    const seen = new Map<string, CommandId>();
    const clashes: string[] = [];

    for (const [commandId, bindings] of Object.entries(SHORTCUTS)) {
      for (const binding of bindings ?? []) {
        const signature = bindingSignature(binding);
        const existing = seen.get(signature);
        if (existing) clashes.push(`${signature}: ${existing} and ${commandId}`);
        seen.set(signature, commandId as CommandId);
      }
    }

    expect(clashes).toEqual([]);
  });

  it("binds each tool's own shortcut to its activation command", () => {
    for (const tool of TOOL_LIST) {
      if (tool.shortcut) expect(SHORTCUTS[`tool.${tool.id}`]).toEqual([tool.shortcut]);
    }
  });

  it("labels a tool's press-again key only when it has something to reselect", () => {
    expect(reselectKeys(getTool("pencil"))).toEqual(commandKeys("tool.pencil").map((key) => `${key} again`));
    expect(reselectKeys(getTool("eraser"))).toEqual(commandKeys("tool.eraser").map((key) => `${key} again`));
    expect(reselectKeys(getTool("picker"))).toEqual([]);
  });

  it("binds V to the mirror toggle, apart from paste", () => {
    expect(SHORTCUTS["tool.toggleMirror"]).toEqual([{ key: "v" }]);
    expect(SHORTCUTS["edit.paste"]).toEqual([{ key: "v", mod: true }]);
  });
});
