import { describe, expect, it } from "vitest";
import { setPixel } from "@/editor/buffer";
import { makeDocument, RED } from "@/test/factories";

describe("SpriteDocument", () => {
  it("creates cels on demand and reports unpainted ones as null", () => {
    const doc = makeDocument();
    expect(doc.getCel("l1", "f1")).toBeNull();
    expect(doc.ensureCel("l1", "f1").pixels.length).toBe(4 * 4 * 4);
    expect(doc.getCel("l1", "f1")).not.toBeNull();
  });

  it("wraps the cel buffer in ImageData without copying", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 0, 0, 4, RED);
    expect(cel.imageData.data[0]).toBe(255);
  });

  it("hands dirty cels to autosave exactly once", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    doc.markPixelsChanged(cel, { x: 0, y: 0, w: 1, h: 1 });

    expect(doc.takeDirtyCels()).toHaveLength(1);
    expect(doc.takeDirtyCels()).toHaveLength(0);
  });

  it("refuses to delete the last layer or frame", () => {
    const doc = makeDocument();
    expect(doc.removeLayer("l1")).toBeNull();
    expect(doc.removeFrame("f1")).toBeNull();
  });

  it("returns removed cels so a delete can be undone exactly", () => {
    const doc = makeDocument();
    const second = doc.addLayer("Layer 2");
    const cel = doc.ensureCel(second.id, "f1");
    setPixel(cel.pixels, 2, 2, 4, RED);

    const removed = doc.removeLayer(second.id);
    expect(removed?.cels).toHaveLength(1);
    expect(doc.getCel(second.id, "f1")).toBeNull();

    doc.insertLayer(removed!.layer, removed!.index, removed!.cels);
    expect(doc.getCel(second.id, "f1")?.pixels[(2 * 4 + 2) * 4]).toBe(255);
  });

  it("deep-copies pixels when duplicating a frame", () => {
    const doc = makeDocument();
    const source = doc.ensureCel("l1", "f1");
    setPixel(source.pixels, 1, 1, 4, RED);

    const copy = doc.addFrame(1, "f1");
    const copied = doc.getCel("l1", copy.id)!;
    expect(copied.pixels[(1 * 4 + 1) * 4]).toBe(255);

    setPixel(copied.pixels, 1, 1, 4, { r: 0, g: 0, b: 0, a: 0 });
    expect(source.pixels[(1 * 4 + 1) * 4]).toBe(255);
  });

  it("bumps the matching revision channel", () => {
    const doc = makeDocument();
    const structure = doc.revisions.structure;
    const meta = doc.revisions.meta;

    doc.addLayer();
    expect(doc.revisions.structure).toBe(structure + 1);
    expect(doc.revisions.meta).toBe(meta);

    doc.setMeta({ fps: 24 });
    expect(doc.revisions.meta).toBe(meta + 1);
  });

  it("keeps in-bounds pixels through a resize", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 0, 0, 4, RED);
    setPixel(cel.pixels, 3, 3, 4, RED);

    doc.resize(2, 2);
    const resized = doc.getCel("l1", "f1")!;
    expect(resized.pixels.length).toBe(2 * 2 * 4);
    expect(resized.pixels[0]).toBe(255);
    expect(doc.width).toBe(2);
  });

  it("reorders layers", () => {
    const doc = makeDocument();
    const second = doc.addLayer("Layer 2");
    doc.moveLayer(1, 0);
    expect(doc.layers.map((layer) => layer.id)).toEqual([second.id, "l1"]);
  });
});
