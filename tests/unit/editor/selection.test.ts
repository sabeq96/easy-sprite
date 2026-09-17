import { describe, expect, it } from "vitest";
import { getPixel, setPixel } from "@/editor/buffer";
import {
  clearSelectionCommand,
  copySelection,
  cutSelectionCommand,
  pasteCommand,
} from "@/editor/commands/selection";
import { setClipboard } from "@/editor/clipboard";
import { createRectSelection, liftRegion, selectAll, stampRegion } from "@/editor/selection";
import { BLUE, makeDocument, RED } from "@test/factories";

describe("selection geometry", () => {
  it("builds a mask matching the rect", () => {
    const selection = createRectSelection(4, 4, { x: 1, y: 1, w: 2, h: 2 })!;
    expect(selection.mask[1 * 4 + 1]).toBe(1);
    expect(selection.mask[0]).toBe(0);
    expect(selection.mask.reduce((sum, value) => sum + value, 0)).toBe(4);
  });

  it("clamps a rect that runs off the canvas", () => {
    const selection = createRectSelection(4, 4, { x: 3, y: 3, w: 10, h: 10 })!;
    expect(selection.rect).toEqual({ x: 3, y: 3, w: 1, h: 1 });
  });

  it("returns null for a rect entirely outside", () => {
    expect(createRectSelection(4, 4, { x: 9, y: 9, w: 2, h: 2 })).toBeNull();
  });

  it("selects everything", () => {
    const selection = selectAll(3, 2);
    expect(selection.rect).toEqual({ x: 0, y: 0, w: 3, h: 2 });
    expect(selection.mask.every((value) => value === 1)).toBe(true);
  });
});

describe("lift and stamp", () => {
  it("cuts the source and stamps it elsewhere", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 0, 0, 4, RED);

    const selection = createRectSelection(4, 4, { x: 0, y: 0, w: 2, h: 2 })!;
    const lifted = liftRegion(doc, "l1", "f1", selection, true)!;

    expect(getPixel(cel.pixels, 0, 0, 4).a).toBe(0);

    stampRegion(doc, "l1", "f1", lifted, { x: 2, y: 2 });
    expect(getPixel(cel.pixels, 2, 2, 4)).toEqual(RED);
  });

  it("leaves the source intact when copying", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 1, 1, 4, RED);

    const selection = createRectSelection(4, 4, { x: 1, y: 1, w: 1, h: 1 })!;
    liftRegion(doc, "l1", "f1", selection, false);

    expect(getPixel(cel.pixels, 1, 1, 4)).toEqual(RED);
  });

  it("does not punch holes with transparent pixels when stamping", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 0, 0, 4, RED); // lifted region covers (0,0)-(1,1), only (0,0) painted
    setPixel(cel.pixels, 2, 2, 4, BLUE); // destination pixel that must survive

    const selection = createRectSelection(4, 4, { x: 0, y: 0, w: 2, h: 2 })!;
    const lifted = liftRegion(doc, "l1", "f1", selection, false)!;

    stampRegion(doc, "l1", "f1", lifted, { x: 2, y: 2 });

    expect(getPixel(cel.pixels, 2, 2, 4)).toEqual(RED); // opaque pixel overwrote it
    expect(getPixel(cel.pixels, 3, 3, 4).a).toBe(0); // transparent pixel wrote nothing
  });

  it("clamps a stamp that runs off the edge", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 0, 0, 4, RED);

    const selection = createRectSelection(4, 4, { x: 0, y: 0, w: 2, h: 2 })!;
    const lifted = liftRegion(doc, "l1", "f1", selection, false)!;

    const written = stampRegion(doc, "l1", "f1", lifted, { x: 3, y: 3 });
    expect(written).toEqual({ x: 3, y: 3, w: 1, h: 1 });
  });
});

describe("clipboard commands", () => {
  it("copies and pastes with exact pixels", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 0, 0, 4, { r: 12, g: 34, b: 56, a: 200 });

    const target = { doc, layerId: "l1", frameId: "f1" };
    const selection = createRectSelection(4, 4, { x: 0, y: 0, w: 1, h: 1 })!;
    copySelection(target, selection);

    setClipboard({
      rect: { x: 2, y: 2, w: 1, h: 1 },
      pixels: new Uint8ClampedArray([12, 34, 56, 200]),
    });
    const pasted = pasteCommand(target)!;

    expect(getPixel(cel.pixels, 2, 2, 4)).toEqual({ r: 12, g: 34, b: 56, a: 200 });

    pasted.command.undo();
    expect(getPixel(cel.pixels, 2, 2, 4).a).toBe(0);
  });

  it("cut clears the region and fills the clipboard", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 1, 1, 4, RED);

    const target = { doc, layerId: "l1", frameId: "f1" };
    const selection = createRectSelection(4, 4, { x: 1, y: 1, w: 1, h: 1 })!;
    const command = cutSelectionCommand(target, selection)!;

    expect(getPixel(cel.pixels, 1, 1, 4).a).toBe(0);

    command.undo();
    expect(getPixel(cel.pixels, 1, 1, 4)).toEqual(RED);
  });

  it("delete restores on undo", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 2, 0, 4, BLUE);

    const selection = createRectSelection(4, 4, { x: 2, y: 0, w: 1, h: 1 })!;
    const command = clearSelectionCommand(
      { doc, layerId: "l1", frameId: "f1" },
      selection,
      "Delete",
    )!;

    expect(getPixel(cel.pixels, 2, 0, 4).a).toBe(0);
    command.undo();
    expect(getPixel(cel.pixels, 2, 0, 4)).toEqual(BLUE);
  });

  it("nudges a paste in-bounds when it would overflow", () => {
    const doc = makeDocument();
    doc.ensureCel("l1", "f1");
    setClipboard({
      rect: { x: 3, y: 3, w: 2, h: 2 },
      pixels: new Uint8ClampedArray(2 * 2 * 4).fill(255),
    });

    const pasted = pasteCommand({ doc, layerId: "l1", frameId: "f1" })!;
    expect(pasted.rect).toEqual({ x: 2, y: 2, w: 2, h: 2 });
  });
});
