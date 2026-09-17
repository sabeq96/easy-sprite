import { describe, expect, it } from "vitest";
import { getPixel, setPixel } from "@/editor/buffer";
import {
  addLayerCommand,
  duplicateLayerCommand,
  mergeLayerDownCommand,
  removeLayerCommand,
  reorderLayerCommand,
  setLayerPropsCommand,
} from "@/editor/commands/layers";
import { BLUE, makeDocument, RED } from "@test/factories";

describe("layer commands", () => {
  it("adds above the active layer and undoes cleanly", () => {
    const doc = makeDocument();
    const command = addLayerCommand(doc, "l1");

    expect(doc.layers).toHaveLength(2);
    expect(doc.layerIndex("l1")).toBe(0);

    command.undo();
    expect(doc.layers).toHaveLength(1);

    command.redo();
    expect(doc.layers).toHaveLength(2);
  });

  it("duplicates pixels without sharing buffers", () => {
    const doc = makeDocument();
    setPixel(doc.ensureCel("l1", "f1").pixels, 1, 1, 4, RED);

    const command = duplicateLayerCommand(doc, "l1")!;
    const copy = doc.layers[1];

    expect(getPixel(doc.getCel(copy.id, "f1")!.pixels, 1, 1, 4)).toEqual(RED);

    setPixel(doc.getCel(copy.id, "f1")!.pixels, 1, 1, 4, BLUE);
    expect(getPixel(doc.getCel("l1", "f1")!.pixels, 1, 1, 4)).toEqual(RED);

    command.undo();
    expect(doc.layers).toHaveLength(1);
  });

  it("refuses to delete the last layer", () => {
    const doc = makeDocument();
    expect(removeLayerCommand(doc, "l1")).toBeNull();
    expect(doc.layers).toHaveLength(1);
  });

  it("restores a deleted layer's pixels on every frame", () => {
    const doc = makeDocument();
    doc.addFrame();
    const extra = doc.addLayer("Extra");
    for (const frame of doc.frames) setPixel(doc.ensureCel(extra.id, frame.id).pixels, 0, 0, 4, RED);

    const command = removeLayerCommand(doc, extra.id)!;
    expect(doc.getCel(extra.id, doc.frames[0].id)).toBeNull();

    command.undo();
    for (const frame of doc.frames) {
      expect(getPixel(doc.getCel(extra.id, frame.id)!.pixels, 0, 0, 4)).toEqual(RED);
    }
  });

  it("reorders and reverses exactly", () => {
    const doc = makeDocument();
    const second = doc.addLayer("Second");
    const command = reorderLayerCommand(doc, 1, 0)!;

    expect(doc.layers.map((layer) => layer.id)).toEqual([second.id, "l1"]);
    command.undo();
    expect(doc.layers.map((layer) => layer.id)).toEqual(["l1", second.id]);
  });

  it("returns null for a no-op reorder", () => {
    const doc = makeDocument();
    expect(reorderLayerCommand(doc, 0, 0)).toBeNull();
  });

  it("restores only the properties it changed", () => {
    const doc = makeDocument();
    doc.setLayerProps("l1", { name: "Base" });

    const command = setLayerPropsCommand(doc, "l1", { visible: false }, "Toggle")!;
    expect(doc.getLayer("l1")!.visible).toBe(false);

    command.undo();
    expect(doc.getLayer("l1")!.visible).toBe(true);
    expect(doc.getLayer("l1")!.name).toBe("Base");
  });

  it("merges down and restores both layers on undo", () => {
    const doc = makeDocument();
    setPixel(doc.ensureCel("l1", "f1").pixels, 0, 0, 4, BLUE);

    const upper = doc.addLayer("Upper");
    setPixel(doc.ensureCel(upper.id, "f1").pixels, 0, 0, 4, RED);

    const command = mergeLayerDownCommand(doc, upper.id)!;

    expect(doc.layers).toHaveLength(1);
    expect(getPixel(doc.getCel("l1", "f1")!.pixels, 0, 0, 4)).toEqual(RED);

    command.undo();
    expect(doc.layers).toHaveLength(2);
    expect(getPixel(doc.getCel("l1", "f1")!.pixels, 0, 0, 4)).toEqual(BLUE);
    expect(getPixel(doc.getCel(upper.id, "f1")!.pixels, 0, 0, 4)).toEqual(RED);
  });

  it("bakes layer opacity into the merge", () => {
    const doc = makeDocument();
    setPixel(doc.ensureCel("l1", "f1").pixels, 0, 0, 4, { r: 0, g: 0, b: 0, a: 255 });

    const upper = doc.addLayer("Upper");
    doc.setLayerProps(upper.id, { opacity: 0.5 });
    setPixel(doc.ensureCel(upper.id, "f1").pixels, 0, 0, 4, { r: 255, g: 255, b: 255, a: 255 });

    mergeLayerDownCommand(doc, upper.id);

    const merged = getPixel(doc.getCel("l1", "f1")!.pixels, 0, 0, 4);
    expect(merged.r).toBeGreaterThan(120);
    expect(merged.r).toBeLessThan(135);
    expect(merged.a).toBe(255);
  });

  it("refuses to merge the bottom layer", () => {
    const doc = makeDocument();
    expect(mergeLayerDownCommand(doc, "l1")).toBeNull();
  });
});
