import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { getPixel, setPixel } from "@/core/buffer";
import type { SpriteDocument } from "@/core/document";
import { History } from "@/core/history";
import { useFramesStore } from "@/editor/frames/api";
import { useLayersStore } from "@/editor/layers/api";
import { useToolboxStore } from "@/editor/toolbox/api";
import { bindCommands } from "@/editor/module";
import { CONTRIBUTED_COMMANDS } from "@/editor/toolbox/contributed";
import { createToolHost } from "@/editor/canvas/api";
import { startToolLifecycle } from "@/editor/canvas/useToolLifecycle";
import type { ContributedCommandId, SettingCommandId } from "@/tools";
import { makeDocument, RED } from "@test/factories";
import { moduleContext } from "@test/modules";
import { resetEditorStores } from "@test/store";

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
  resetEditorStores();
  useFramesStore.setState({ activeFrameId: "f1" });
  useLayersStore.setState({ activeLayerId: "l1" });
});

afterEach(() => stop?.());

function setup() {
  const host = createToolHost({ doc, history });
  stop = startToolLifecycle(host);
  return bindCommands(CONTRIBUTED_COMMANDS, moduleContext({ doc, history, host }));
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
      expect(commands[id]?.keys?.length).toBeGreaterThan(0);
    }
    expect(commands["edit.copy"]?.keys).toEqual([{ key: "c", mod: true }]);
    expect(commands["edit.deleteSelection"]?.keys).toEqual([{ key: "delete" }, { key: "backspace" }]);
  });

  it("paste activates select before selecting, so deselect becomes enabled", () => {
    setPixel(doc.ensureCel("l1", "f1").pixels, 2, 1, 4, RED);
    const commands = setup();
    useToolboxStore.getState().setTool("select");
    commands["edit.selectAll"]!.run();
    commands["edit.copy"]!.run();
    commands["edit.deselect"]!.run();
    useToolboxStore.getState().setTool("pencil");
    doc.ensureCel("l1", "f1").pixels.fill(0);

    commands["edit.paste"]!.run();

    expect(useToolboxStore.getState().toolId).toBe("select");
    expect(commands["edit.deselect"]!.isEnabled!()).toBe(true);
    expect(getPixel(doc.getCel("l1", "f1")!.pixels, 2, 1, 4)).toEqual(RED);
    expect(history.undoLabel).toBe("Paste");
    history.undo();
    expect(history.canUndo).toBe(false);
  });

  it("paste on a locked layer neither edits nor switches tools", () => {
    const commands = setup();
    useToolboxStore.getState().setTool("select");
    commands["edit.selectAll"]!.run();
    commands["edit.copy"]!.run();
    useToolboxStore.getState().setTool("pencil");
    doc.setLayerProps("l1", { locked: true });

    commands["edit.paste"]!.run();

    expect(useToolboxStore.getState().toolId).toBe("pencil");
    expect(history.canUndo).toBe(false);
  });

  it("generates the mirror command from the pencil's setting: enabled only on the pencil, flipping its value", () => {
    const commands = setup();
    const mirror = commands["tool.toggleMirror"];

    expect(mirror).toMatchObject({ label: "Mirror horizontally", group: "Tools" });
    expect(mirror?.keys).toEqual([{ key: "v" }]);
    expect(mirror?.isEnabled?.()).toBe(true);
    expect(mirror?.isActive?.()).toBe(false);

    mirror?.run();
    expect(useToolboxStore.getState().settings).toEqual({ pencil: { mirrorHorizontal: true } });
    expect(mirror?.isActive?.()).toBe(true);
    mirror?.run();
    expect(useToolboxStore.getState().settings.pencil).toEqual({ mirrorHorizontal: false });

    useToolboxStore.getState().setTool("eraser");
    expect(mirror?.isEnabled?.()).toBe(false);
  });
});
