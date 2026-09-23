import { describe, expect, it } from "vitest";
import { commandKeys, HELD_TOOL_KEYS, SHORTCUTS, toolKeys } from "@/commands/keymap";
import type { CommandId } from "@/commands/types";
import { TOOL_LIST } from "@/editor/tools";
import { bindingSignature, formatModifier } from "@/lib/keys";

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

  it("derives held keys from the tools that declare one", () => {
    expect(HELD_TOOL_KEYS).toEqual({ alt: "picker" });
  });

  it("shows a tool's own key, then the key held to borrow it", () => {
    const picker = TOOL_LIST.find((tool) => tool.id === "picker")!;
    const pencil = TOOL_LIST.find((tool) => tool.id === "pencil")!;

    expect(toolKeys(picker)).toEqual([...commandKeys("tool.picker"), `Hold ${formatModifier("alt")}`]);
    expect(toolKeys(pencil)).toEqual(commandKeys("tool.pencil"));
  });
});
