import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { CommandId } from "@/commands/types";
import { SESSION_COMMANDS } from "@/commands/session";
import { SHARED_KEYS, type SharedViewCommandId } from "@/constants/shortcuts";
import { bindCommands, type ModuleCommand } from "@/editor/module";
import { bindEditorCommands, EDITOR_MODULES, type ModuleCommandId } from "@/editor/modules";
import { useToolboxStore } from "@/editor/toolbox/api";
import { bindingSignature } from "@/lib/keys";
import { moduleContext } from "@test/modules";
import { resetEditorStores } from "@test/store";

function duplicates(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

const definitions = () => EDITOR_MODULES.flatMap((editorModule) => editorModule.commands ?? []);

describe("EDITOR_MODULES", () => {
  it("gives every module a unique id", () => {
    expect(duplicates(EDITOR_MODULES.map(({ id }) => id))).toEqual([]);
  });

  it("never declares one command id twice across modules", () => {
    expect(duplicates(definitions().map(({ id }) => id))).toEqual([]);
  });

  it("binds no chord to two commands in the editor's registry", () => {
    const registry = bindEditorCommands(moduleContext());
    const chords = Object.values(registry).flatMap((command) =>
      (command?.keys ?? []).map(bindingSignature),
    );

    expect(chords.length).toBeGreaterThan(0);
    expect(duplicates(chords)).toEqual([]);
  });

  it("binds the session commands and takes the shared view keys from SHARED_KEYS", () => {
    const registry = bindEditorCommands(moduleContext());
    for (const command of SESSION_COMMANDS) expect(registry[command.id]?.keys).toBe(command.keys);
    for (const id of Object.keys(SHARED_KEYS) as SharedViewCommandId[]) {
      expect(registry[id]?.keys).toBe(SHARED_KEYS[id]);
    }
  });

  it("derives command ids from the module definitions", () => {
    expectTypeOf<"layer.add" | "view.toggleOnion" | "edit.undo">().toExtend<ModuleCommandId>();
    expectTypeOf<SharedViewCommandId>().toExtend<CommandId>();
    expectTypeOf<"layer.addd">().not.toExtend<CommandId>();
  });
});

describe("bindCommands", () => {
  const sample: readonly ModuleCommand[] = [
    {
      id: "edit.undo",
      label: "Undo",
      group: "Edit",
      keys: [{ key: "z", mod: true }],
      isEnabled: ({ history }) => history.canUndo,
      run: ({ history }) => history.undo(),
    },
    { id: "app.keyboardShortcuts", label: "Keyboard shortcuts", group: "App", run: (ctx) => ctx.showHelp() },
  ];

  it("binds each definition to the context, in order, keeping its wording and keys", () => {
    const showHelp = vi.fn();
    const ctx = moduleContext({ showHelp });
    const registry = bindCommands(sample, ctx);

    expect(Object.keys(registry)).toEqual(["edit.undo", "app.keyboardShortcuts"]);
    expect(registry["edit.undo"]).toMatchObject({ id: "edit.undo", label: "Undo", group: "Edit" });
    expect(registry["edit.undo"]?.keys).toEqual([{ key: "z", mod: true }]);
    expect(registry["edit.undo"]?.isEnabled?.()).toBe(false);

    registry["app.keyboardShortcuts"]?.run();
    expect(showHelp).toHaveBeenCalledOnce();
  });

  it("leaves out what a definition does not declare, so toggles stay distinguishable", () => {
    const registry = bindCommands(sample, moduleContext());

    expect(registry["app.keyboardShortcuts"]?.isActive).toBeUndefined();
    expect(registry["app.keyboardShortcuts"]?.isEnabled).toBeUndefined();
    expect(registry["app.keyboardShortcuts"]?.keys).toBeUndefined();
    expect(registry["app.keyboardShortcuts"]?.hold).toBeUndefined();
  });

  it("runs the editor's module commands against the context's document and history", () => {
    resetEditorStores();
    const ctx = moduleContext();
    const registry = bindEditorCommands(ctx);

    registry["layer.add"]?.run();
    expect(ctx.doc.layers).toHaveLength(2);
    expect(registry["edit.undo"]?.isEnabled?.()).toBe(true);
    registry["edit.undo"]?.run();
    expect(ctx.doc.layers).toHaveLength(1);

    registry["frame.add"]?.run();
    expect(ctx.doc.frames).toHaveLength(2);
    expect(registry["frame.delete"]?.isEnabled?.()).toBe(true);
  });

  it("binds a tool key's hold, which switches tools through the toolbox store", () => {
    resetEditorStores();
    const registry = bindEditorCommands(moduleContext());

    registry["tool.eraser"]?.hold?.press({ code: "KeyE", at: 0 });
    registry["tool.eraser"]?.hold?.release({ code: "KeyE", at: 10 });

    expect(useToolboxStore.getState().toolId).toBe("eraser");
    expect(registry["tool.eraser"]?.isActive?.()).toBe(true);
  });
});
