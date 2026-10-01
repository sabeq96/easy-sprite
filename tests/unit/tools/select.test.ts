import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createContributedCommands } from "@/commands/contributed";
import type { CommandId, CommandRegistry } from "@/commands/types";
import { getPixel, setPixel } from "@/core/buffer";
import type { SpriteDocument } from "@/core/document";
import { History, StrokeRecorder, type Command } from "@/core/history";
import type { PointerModifiers } from "@/framework/host";
import type { ToolPoint } from "@/framework/tool";
import { createToolHost, type DocumentToolHost } from "@/hooks/toolHost/createToolHost";
import { startToolLifecycle } from "@/hooks/useToolLifecycle";
import { useEditorStore } from "@/stores/useEditorStore";
import { selectedRect, selectTool } from "@/tools/select/tool";
import { makeDocument, makeGesture, NO_MODIFIERS, RED } from "@test/factories";
import { resetEditorStores } from "@test/store";

const CTRL: PointerModifiers = { ...NO_MODIFIERS, ctrl: true };

let doc: SpriteDocument;
let history: History;
let host: DocumentToolHost;
let commands: CommandRegistry;
let stop: () => void;

beforeEach(() => {
  doc = makeDocument();
  history = new History();
  resetEditorStores();
  useEditorStore.setState({ toolId: "select", activeLayerId: "l1", activeFrameId: "f1" });
  host = createToolHost({ doc, history });
  commands = createContributedCommands(host);
  stop = startToolLifecycle(host);
});

afterEach(() => stop());

const deactivate = () => useEditorStore.getState().setTool("pencil");
const run = (id: CommandId) => commands[id]!.run();
const isEnabled = (id: CommandId) => commands[id]!.isEnabled!();

interface Stroke {
  recorder: StrokeRecorder;
  down(point: ToolPoint): void;
  move(point: ToolPoint): void;
  up(): void;
}

/** A gesture through the same calls usePointerPaint makes, on one pinned surface. */
function stroke(modifiers = NO_MODIFIERS): Stroke {
  const toolHost = host.forTool("select");
  const recorder = new StrokeRecorder(doc, "Select & move");
  let first: ReturnType<typeof makeGesture> | null = null;
  let previous: ToolPoint = { x: 0, y: 0 };

  const at = (point: ToolPoint) =>
    makeGesture(doc, point, { previous, modifiers, recorder, surface: first?.surface });

  return {
    recorder,
    down(point) {
      previous = point;
      first = at(point);
      selectTool.onPointerDown(toolHost, first);
    },
    move(point) {
      selectTool.onPointerMove!(toolHost, at(point));
      previous = point;
    },
    up() {
      selectTool.onPointerUp!(toolHost, at(previous));
    },
  };
}

/** A whole gesture, recorded into history the way the pointer pipeline does. */
function gesture(points: ToolPoint[], modifiers = NO_MODIFIERS): Command | null {
  const drag = stroke(modifiers);
  const [first, ...rest] = points;
  drag.down(first);
  for (const point of rest) drag.move(point);
  drag.up();
  const command = drag.recorder.commit();
  if (command) history.push(command);
  return command;
}

const pixel = (x: number, y: number) => getPixel(doc.getCel("l1", "f1")!.pixels, x, y, 4);

describe("select tool: selecting", () => {
  it("a click selects one pixel", () => {
    gesture([{ x: 2, y: 1 }]);
    expect(selectedRect()).toEqual({ x: 2, y: 1, w: 1, h: 1 });
  });

  it("a drag selects a rectangle, clamped to the canvas", () => {
    gesture([{ x: 1, y: 1 }, { x: 3, y: 2 }]);
    expect(selectedRect()).toEqual({ x: 1, y: 1, w: 3, h: 2 });

    // Starts outside the first selection, so this is a new marquee rather than a move.
    gesture([{ x: 0, y: 3 }, { x: 9, y: 9 }]);
    expect(selectedRect()).toEqual({ x: 0, y: 3, w: 4, h: 1 });
  });

  it("a click off-canvas selects nothing, and a click outside replaces the selection", () => {
    gesture([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    gesture([{ x: 3, y: 3 }]);
    expect(selectedRect()).toEqual({ x: 3, y: 3, w: 1, h: 1 });

    gesture([{ x: -2, y: -2 }]);
    expect(selectedRect()).toBeNull();
    expect(isEnabled("edit.copy")).toBe(false);
  });

  it("hovering the selection asks for a grab cursor", () => {
    gesture([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
    const toolHost = host.forTool("select");
    expect(selectTool.onHover!(toolHost, { x: 2, y: 1 })).toBe("grab");
    expect(selectTool.onHover!(toolHost, { x: 0, y: 0 })).toBeNull();
    expect(selectTool.onHover!(toolHost, null)).toBeNull();
  });
});

describe("select tool: moving", () => {
  beforeEach(() => {
    setPixel(doc.ensureCel("l1", "f1").pixels, 0, 0, 4, RED);
    gesture([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });

  it("dragging from inside moves the pixels, and the selection follows in one undo step", () => {
    gesture([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }]);

    expect(pixel(0, 0).a).toBe(0);
    expect(pixel(2, 1)).toEqual(RED);
    expect(selectedRect()).toEqual({ x: 2, y: 1, w: 2, h: 2 });

    history.undo();
    expect(pixel(0, 0)).toEqual(RED);
    expect(pixel(2, 1).a).toBe(0);
    expect(history.canUndo).toBe(false);
  });

  it("Ctrl+drag copies instead of cutting", () => {
    gesture([{ x: 0, y: 0 }, { x: 2, y: 2 }], CTRL);
    expect(pixel(0, 0)).toEqual(RED);
    expect(pixel(2, 2)).toEqual(RED);
  });

  it("a click inside without moving changes nothing", () => {
    expect(gesture([{ x: 1, y: 1 }])).toBeNull();
    expect(selectedRect()).toEqual({ x: 0, y: 0, w: 2, h: 2 });
  });

  it("deactivating mid-move reverts the pixels and records nothing", () => {
    const drag = stroke();
    drag.down({ x: 0, y: 0 });
    drag.move({ x: 2, y: 2 });
    expect(pixel(0, 0).a).toBe(0);

    deactivate();
    // The stale pointerup must be harmless once the tool is gone.
    drag.up();

    expect(pixel(0, 0)).toEqual(RED);
    expect(pixel(2, 2).a).toBe(0);
    expect(drag.recorder.commit()).toBeNull();
  });
});

describe("select tool: commands", () => {
  beforeEach(() => {
    setPixel(doc.ensureCel("l1", "f1").pixels, 1, 1, 4, RED);
  });

  it("copy then paste lands at the copied position, as one Paste undo step", () => {
    gesture([{ x: 1, y: 1 }]);
    run("edit.copy");
    run("edit.deleteSelection");
    expect(pixel(1, 1).a).toBe(0);

    run("edit.paste");

    expect(pixel(1, 1)).toEqual(RED);
    expect(selectedRect()).toEqual({ x: 1, y: 1, w: 1, h: 1 });
    expect(history.undoLabel).toBe("Paste");
    history.undo();
    expect(pixel(1, 1).a).toBe(0);
    expect(history.undoLabel).toBe("Delete");
  });

  it("cut clears the selection's pixels into the clipboard, as one Cut undo step", () => {
    gesture([{ x: 1, y: 1 }]);
    run("edit.cut");

    expect(pixel(1, 1).a).toBe(0);
    expect(history.undoLabel).toBe("Cut");
    history.undo();
    expect(pixel(1, 1)).toEqual(RED);
  });

  it("deselect drops the selection and disables the selection commands", () => {
    run("edit.selectAll");
    expect(selectedRect()).toEqual({ x: 0, y: 0, w: 4, h: 4 });
    expect(isEnabled("edit.deselect")).toBe(true);

    run("edit.deselect");

    expect(selectedRect()).toBeNull();
    expect(isEnabled("edit.deselect")).toBe(false);
    expect(isEnabled("edit.copy")).toBe(false);
  });

  it("delete on a locked layer changes nothing and records nothing", () => {
    gesture([{ x: 1, y: 1 }]);
    doc.setLayerProps("l1", { locked: true });

    run("edit.deleteSelection");

    expect(pixel(1, 1)).toEqual(RED);
    expect(history.canUndo).toBe(false);
  });
});

describe("select tool: lifecycle", () => {
  const noop: Command = { label: "x", sizeBytes: 0, undo: () => {}, redo: () => {} };

  it("deactivating clears the selection", () => {
    run("edit.selectAll");
    deactivate();
    expect(selectedRect()).toBeNull();
    expect(isEnabled("edit.deselect")).toBe(false);
  });

  it("undo and redo clear the selection; a push does not", () => {
    run("edit.selectAll");
    history.push(noop);
    expect(selectedRect()).not.toBeNull();

    history.undo();
    expect(selectedRect()).toBeNull();

    run("edit.selectAll");
    history.redo();
    expect(selectedRect()).toBeNull();
  });

  it("a canvas resize clears the selection", () => {
    run("edit.selectAll");
    doc.resize(8, 8, {}, doc.tileSize);
    expect(selectedRect()).toBeNull();
  });
});
