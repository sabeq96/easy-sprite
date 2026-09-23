import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPixel, setPixel } from "@/editor/buffer";
import type { SpriteDocument } from "@/editor/document";
import { History, type Command } from "@/editor/history";
import { selection, selectTool } from "@/editor/tools/select";
import type { PointerModifiers, ToolPoint, ToolSession } from "@/editor/tools/types";
import { makeDocument, makeToolContext, RED } from "@test/factories";

const NO_MODIFIERS: PointerModifiers = { button: 0, shift: false, alt: false, ctrl: false };
const CTRL: PointerModifiers = { ...NO_MODIFIERS, ctrl: true };

let doc: SpriteDocument;
let history: History;
let deactivate: () => void;

beforeEach(() => {
  doc = makeDocument();
  history = new History();
  const session: ToolSession = { doc, history, setOverlay: vi.fn(), requestRender: vi.fn() };
  deactivate = selectTool.onActivate!(session);
});

afterEach(() => deactivate());

/** One full gesture through the same calls usePointerPaint makes. Returns the stroke. */
function gesture(points: ToolPoint[], modifiers = NO_MODIFIERS) {
  const { ctx, stroke } = makeToolContext(doc);
  const [first, ...rest] = points;
  selectTool.onPointerDown(ctx, first, modifiers);
  let previous = first;
  for (const point of rest) {
    selectTool.onPointerMove!(ctx, point, previous, modifiers);
    previous = point;
  }
  selectTool.onPointerUp!(ctx, previous, modifiers);
  return stroke;
}

const pixel = (x: number, y: number) => getPixel(doc.getCel("l1", "f1")!.pixels, x, y, 4);

describe("select tool: selecting", () => {
  it("a click selects one pixel", () => {
    gesture([{ x: 2, y: 1 }]);
    expect(selection.get()).toEqual({ x: 2, y: 1, w: 1, h: 1 });
  });

  it("a drag selects a rectangle, clamped to the canvas", () => {
    gesture([{ x: 1, y: 1 }, { x: 3, y: 2 }]);
    expect(selection.get()).toEqual({ x: 1, y: 1, w: 3, h: 2 });

    // Starts outside the first selection, so this is a new marquee rather than a move.
    gesture([{ x: 0, y: 3 }, { x: 9, y: 9 }]);
    expect(selection.get()).toEqual({ x: 0, y: 3, w: 4, h: 1 });
  });

  it("a click off-canvas selects nothing, and a click outside replaces the selection", () => {
    gesture([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    gesture([{ x: 3, y: 3 }]);
    expect(selection.get()).toEqual({ x: 3, y: 3, w: 1, h: 1 });

    gesture([{ x: -2, y: -2 }]);
    expect(selection.get()).toBeNull();
  });

  it("hovering the selection asks for a grab cursor", () => {
    gesture([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
    expect(selectTool.onHover!({ x: 2, y: 1 })).toBe("grab");
    expect(selectTool.onHover!({ x: 0, y: 0 })).toBeNull();
    expect(selectTool.onHover!(null)).toBeNull();
  });
});

describe("select tool: moving", () => {
  beforeEach(() => {
    setPixel(doc.ensureCel("l1", "f1").pixels, 0, 0, 4, RED);
    gesture([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });

  it("dragging from inside moves the pixels, and the selection follows in one undo step", () => {
    const stroke = gesture([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }]);

    expect(pixel(0, 0).a).toBe(0);
    expect(pixel(2, 1)).toEqual(RED);
    expect(selection.get()).toEqual({ x: 2, y: 1, w: 2, h: 2 });

    const command = stroke.commit()!;
    command.undo();
    expect(pixel(0, 0)).toEqual(RED);
    expect(pixel(2, 1).a).toBe(0);
  });

  it("Ctrl+drag copies instead of cutting", () => {
    gesture([{ x: 0, y: 0 }, { x: 2, y: 2 }], CTRL);
    expect(pixel(0, 0)).toEqual(RED);
    expect(pixel(2, 2)).toEqual(RED);
  });

  it("a click inside without moving changes nothing", () => {
    const stroke = gesture([{ x: 1, y: 1 }]);
    expect(selection.get()).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    expect(stroke.commit()).toBeNull();
  });

  it("deactivating mid-drag puts the cut pixels back", () => {
    const { ctx, stroke } = makeToolContext(doc);
    selectTool.onPointerDown(ctx, { x: 0, y: 0 }, NO_MODIFIERS);
    selectTool.onPointerMove!(ctx, { x: 2, y: 2 }, { x: 0, y: 0 }, NO_MODIFIERS);
    expect(pixel(0, 0).a).toBe(0);

    deactivate();
    // The stale pointerup must be harmless once the tool is gone.
    selectTool.onPointerUp!(ctx, { x: 2, y: 2 }, NO_MODIFIERS);

    expect(pixel(0, 0)).toEqual(RED);
    expect(pixel(2, 2).a).toBe(0);
    expect(stroke.commit()).toBeNull();
  });
});

describe("select tool: lifecycle", () => {
  const noop: Command = { label: "x", sizeBytes: 0, undo: () => {}, redo: () => {} };

  it("deactivating clears the selection, and writes are ignored while inactive", () => {
    selection.set({ x: 0, y: 0, w: 2, h: 2 });
    deactivate();

    expect(selection.get()).toBeNull();
    selection.set({ x: 0, y: 0, w: 2, h: 2 });
    expect(selection.get()).toBeNull();
  });

  it("set clamps to the canvas", () => {
    selection.set({ x: 3, y: 3, w: 5, h: 5 });
    expect(selection.get()).toEqual({ x: 3, y: 3, w: 1, h: 1 });
  });

  it("undo and redo clear the selection; a push does not", () => {
    selection.set({ x: 0, y: 0, w: 2, h: 2 });
    history.push(noop);
    expect(selection.get()).not.toBeNull();

    history.undo();
    expect(selection.get()).toBeNull();

    selection.set({ x: 0, y: 0, w: 2, h: 2 });
    history.redo();
    expect(selection.get()).toBeNull();
  });

  it("a canvas resize clears the selection", () => {
    selection.set({ x: 0, y: 0, w: 2, h: 2 });
    doc.resize(8, 8);
    expect(selection.get()).toBeNull();
  });
});
