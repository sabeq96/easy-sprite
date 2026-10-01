import { describe, expect, it } from "vitest";
import { getPixel, setPixel } from "@/editor/buffer";
import {
  clearSelectionCommand,
  copySelection,
  cutSelectionCommand,
  pasteCommand,
} from "@/editor/commands/selection";
import { setClipboard } from "@/editor/clipboard";
import { liftRegion, stampRegion } from "@/editor/selection";
import { BLUE, makeDocument, RED } from "@test/factories";

describe("lift and stamp", () => {
  it("cuts the source and stamps it elsewhere", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 0, 0, 4, RED);

    const rect = { x: 0, y: 0, w: 2, h: 2 };
    const lifted = liftRegion(doc, "l1", "f1", rect, true);

    expect(getPixel(cel.pixels, 0, 0, 4).a).toBe(0);

    stampRegion(doc, "l1", "f1", lifted, { x: 2, y: 2 });
    expect(getPixel(cel.pixels, 2, 2, 4)).toEqual(RED);
  });

  it("leaves the source intact when copying", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 1, 1, 4, RED);

    const rect = { x: 1, y: 1, w: 1, h: 1 };
    liftRegion(doc, "l1", "f1", rect, false);

    expect(getPixel(cel.pixels, 1, 1, 4)).toEqual(RED);
  });

  it("does not punch holes with transparent pixels when stamping", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 0, 0, 4, RED); // lifted region covers (0,0)-(1,1), only (0,0) painted
    setPixel(cel.pixels, 2, 2, 4, BLUE); // destination pixel that must survive

    const rect = { x: 0, y: 0, w: 2, h: 2 };
    const lifted = liftRegion(doc, "l1", "f1", rect, false);

    stampRegion(doc, "l1", "f1", lifted, { x: 2, y: 2 });

    expect(getPixel(cel.pixels, 2, 2, 4)).toEqual(RED); // opaque pixel overwrote it
    expect(getPixel(cel.pixels, 3, 3, 4).a).toBe(0); // transparent pixel wrote nothing
  });

  it("lifts transparent pixels from a layer with no cel yet", () => {
    const doc = makeDocument();

    const lifted = liftRegion(doc, "l1", "f1", { x: 0, y: 0, w: 2, h: 2 }, true);

    expect(lifted.pixels.every((value) => value === 0)).toBe(true);
    expect(doc.getCel("l1", "f1")).toBeDefined();
  });

  it("clamps a stamp that runs off the edge", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 0, 0, 4, RED);

    const rect = { x: 0, y: 0, w: 2, h: 2 };
    const lifted = liftRegion(doc, "l1", "f1", rect, false);

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
    const rect = { x: 0, y: 0, w: 1, h: 1 };
    copySelection(target, rect);

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
    const rect = { x: 1, y: 1, w: 1, h: 1 };
    const command = cutSelectionCommand(target, rect)!;

    expect(getPixel(cel.pixels, 1, 1, 4).a).toBe(0);

    command.undo();
    expect(getPixel(cel.pixels, 1, 1, 4)).toEqual(RED);
  });

  it("delete restores on undo", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 2, 0, 4, BLUE);

    const rect = { x: 2, y: 0, w: 1, h: 1 };
    const command = clearSelectionCommand(
      { doc, layerId: "l1", frameId: "f1" },
      rect,
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
