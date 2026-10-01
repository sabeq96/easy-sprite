import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { createContributedCommands } from "@/commands/contributed";
import { SHORTCUTS } from "@/commands/keymap";
import { getPixel, setPixel } from "@/core/buffer";
import type { SpriteDocument } from "@/core/document";
import { History } from "@/core/history";
import { createToolHost } from "@/hooks/toolHost/createToolHost";
import { startToolLifecycle } from "@/hooks/useToolLifecycle";
import { useEditorStore } from "@/stores/useEditorStore";
import type { ContributedCommandId, SettingCommandId } from "@/tools";
import { makeDocument, RED } from "@test/factories";

const SELECTION_COMMANDS = [
  "edit.selectAll",
  "edit.deselect",
  "edit.copy",
  "edit.cut",
  "edit.paste",
  "edit.deleteSelection",
] as const;

let doc: SpriteDocument;
let history: History;
let stop: () => void;

beforeEach(() => {
  doc = makeDocument();
  history = new History();
  useEditorStore.setState(
    { ...useEditorStore.getInitialState(), activeLayerId: "l1", activeFrameId: "f1" },
    true,
  );
});

afterEach(() => stop?.());

function setup() {
  const host = createToolHost({ doc, history });
  stop = startToolLifecycle(host);
  return createContributedCommands(host);
}

describe("contributed commands", () => {
  it("derives their ids from the tools", () => {
    expectTypeOf<ContributedCommandId>().toEqualTypeOf<(typeof SELECTION_COMMANDS)[number]>();
    expectTypeOf<SettingCommandId>().toEqualTypeOf<"tool.toggleMirror">();
  });

  it("registers the select tool's six commands and the pencil's mirror, each with its keys once", () => {
    const commands = setup();

    expect(Object.keys(commands).sort()).toEqual([...SELECTION_COMMANDS, "tool.toggleMirror"].sort());
    for (const id of SELECTION_COMMANDS) {
      expect(commands[id]?.id).toBe(id);
      expect(SHORTCUTS[id]?.length).toBeGreaterThan(0);
    }
    expect(SHORTCUTS["edit.copy"]).toEqual([{ key: "c", mod: true }]);
    expect(SHORTCUTS["edit.deleteSelection"]).toEqual([{ key: "delete" }, { key: "backspace" }]);
  });

  it("paste activates select before selecting, so deselect becomes enabled", () => {
    setPixel(doc.ensureCel("l1", "f1").pixels, 2, 1, 4, RED);
    const commands = setup();
    useEditorStore.getState().setTool("select");
    commands["edit.selectAll"]!.run();
    commands["edit.copy"]!.run();
    commands["edit.deselect"]!.run();
    useEditorStore.getState().setTool("pencil");
    doc.ensureCel("l1", "f1").pixels.fill(0);

    commands["edit.paste"]!.run();

    expect(useEditorStore.getState().toolId).toBe("select");
    expect(commands["edit.deselect"]!.isEnabled!()).toBe(true);
    expect(getPixel(doc.getCel("l1", "f1")!.pixels, 2, 1, 4)).toEqual(RED);
    expect(history.undoLabel).toBe("Paste");
    history.undo();
    expect(history.canUndo).toBe(false);
  });

  it("paste on a locked layer neither edits nor switches tools", () => {
    const commands = setup();
    useEditorStore.getState().setTool("select");
    commands["edit.selectAll"]!.run();
    commands["edit.copy"]!.run();
    useEditorStore.getState().setTool("pencil");
    doc.setLayerProps("l1", { locked: true });

    commands["edit.paste"]!.run();

    expect(useEditorStore.getState().toolId).toBe("pencil");
    expect(history.canUndo).toBe(false);
  });

  it("generates the mirror command from the pencil's setting: enabled only on the pencil, flipping its value", () => {
    const commands = setup();
    const mirror = commands["tool.toggleMirror"];

    expect(mirror).toMatchObject({ label: "Mirror horizontally", group: "Tools" });
    expect(SHORTCUTS["tool.toggleMirror"]).toEqual([{ key: "v" }]);
    expect(mirror?.isEnabled?.()).toBe(true);
    expect(mirror?.isActive?.()).toBe(false);

    mirror?.run();
    expect(useEditorStore.getState().settings).toEqual({ pencil: { mirrorHorizontal: true } });
    expect(mirror?.isActive?.()).toBe(true);
    mirror?.run();
    expect(useEditorStore.getState().settings.pencil).toEqual({ mirrorHorizontal: false });

    useEditorStore.getState().setTool("eraser");
    expect(mirror?.isEnabled?.()).toBe(false);
  });
});
