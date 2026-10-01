import { describe, expect, it } from "vitest";
import { createContributedCommands } from "@/commands/contributed";
import { SHORTCUTS } from "@/commands/keymap";
import { createToolCommands } from "@/commands/toolCommands";
import type { CommandRegistry } from "@/commands/types";
import { History } from "@/core/history";
import type { ModuleContext } from "@/editor/module";
import { EDITOR_MODULES } from "@/editor/modules";
import { createToolHost } from "@/hooks/toolHost/createToolHost";
import { bindingSignature } from "@/lib/keys";
import { useEditorStore } from "@/stores/useEditorStore";
import { makeDocument } from "@test/factories";

function moduleContext(): ModuleContext {
  return {
    doc: makeDocument(),
    history: new History(),
    dispatch: () => false,
    navigate: () => {},
    showHelp: () => {},
    save: () => Promise.resolve(),
  };
}

function duplicates(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

describe("EDITOR_MODULES", () => {
  it("gives every module a unique id", () => {
    expect(duplicates(EDITOR_MODULES.map(({ id }) => id))).toEqual([]);
  });

  it("never registers one command id twice across modules and tools", () => {
    const ctx = moduleContext();
    const registries: CommandRegistry[] = [
      ...EDITOR_MODULES.map((editorModule) => editorModule.commands?.(ctx) ?? {}),
      createToolCommands(useEditorStore),
      createContributedCommands(createToolHost({ doc: ctx.doc, history: ctx.history })),
    ];

    expect(duplicates(registries.flatMap((registry) => Object.keys(registry)))).toEqual([]);
  });

  it("binds no chord to two commands in the merged keymap", () => {
    const chords = Object.values(SHORTCUTS).flatMap((bindings) =>
      (bindings ?? []).map(bindingSignature),
    );

    expect(duplicates(chords)).toEqual([]);
  });
});
