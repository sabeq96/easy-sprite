import { describe, expect, it } from "vitest";
import { getPixel, setPixel } from "@/editor/buffer";
import { eraserTool } from "@/editor/tools/eraser";
import { bucketTool, fillSimilarTool } from "@/editor/tools/fill";
import { mirrorPencilTool, pencilTool } from "@/editor/tools/pencil";
import { pickerTool } from "@/editor/tools/picker";
import { BLUE, makeDocument, makeToolContext, RED } from "@test/factories";

const NO_MODIFIERS = { button: 0, shift: false, alt: false, ctrl: false };

describe("pencil", () => {
  it("paints a single pixel on pointer down", () => {
    const doc = makeDocument();
    const { ctx } = makeToolContext(doc);

    pencilTool.onPointerDown(ctx, { x: 1, y: 1 }, NO_MODIFIERS);

    expect(getPixel(doc.getCel("l1", "f1")!.pixels, 1, 1, 4)).toEqual(RED);
  });

  it("joins sampled positions with no gaps", () => {
    const doc = makeDocument();
    const { ctx } = makeToolContext(doc);

    pencilTool.onPointerDown(ctx, { x: 0, y: 0 }, NO_MODIFIERS);
    pencilTool.onPointerMove!(ctx, { x: 3, y: 0 }, { x: 0, y: 0 }, NO_MODIFIERS);

    const pixels = doc.getCel("l1", "f1")!.pixels;
    for (let x = 0; x <= 3; x++) expect(getPixel(pixels, x, 0, 4)).toEqual(RED);
  });

  it("stamps a square brush for larger sizes", () => {
    const doc = makeDocument();
    const { ctx } = makeToolContext(doc, {
      options: {
        brushSize: 2,
        mirrorHorizontal: false,
        mirrorVertical: false,
        fillTolerance: 0,
        pickFromComposite: false,
      },
    });

    pencilTool.onPointerDown(ctx, { x: 0, y: 0 }, NO_MODIFIERS);

    const pixels = doc.getCel("l1", "f1")!.pixels;
    expect(getPixel(pixels, 1, 1, 4)).toEqual(RED);
    expect(getPixel(pixels, 2, 2, 4).a).toBe(0);
  });

  it("clips writes at the canvas edge", () => {
    const doc = makeDocument();
    const { ctx } = makeToolContext(doc);

    // Must not throw, and must not wrap around to the opposite edge.
    pencilTool.onPointerDown(ctx, { x: -1, y: 0 }, NO_MODIFIERS);
    expect(getPixel(doc.ensureCel("l1", "f1").pixels, 3, 0, 4).a).toBe(0);
  });

  it("mirrors across the vertical axis", () => {
    const doc = makeDocument();
    const { ctx } = makeToolContext(doc);

    mirrorPencilTool.onPointerDown(ctx, { x: 0, y: 2 }, NO_MODIFIERS);

    const pixels = doc.getCel("l1", "f1")!.pixels;
    expect(getPixel(pixels, 0, 2, 4)).toEqual(RED);
    expect(getPixel(pixels, 3, 2, 4)).toEqual(RED);
  });

  it("honours a selection mask", () => {
    const doc = makeDocument();
    const mask = new Uint8Array(16);
    mask[0] = 1; // only pixel (0,0) is editable
    const { ctx } = makeToolContext(doc, { mask });

    pencilTool.onPointerDown(ctx, { x: 0, y: 0 }, NO_MODIFIERS);
    pencilTool.onPointerDown(ctx, { x: 1, y: 0 }, NO_MODIFIERS);

    const pixels = doc.getCel("l1", "f1")!.pixels;
    expect(getPixel(pixels, 0, 0, 4)).toEqual(RED);
    expect(getPixel(pixels, 1, 0, 4).a).toBe(0);
  });
});

describe("eraser", () => {
  it("zeroes pixels rather than blending transparency over them", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 2, 2, 4, RED);

    const { ctx } = makeToolContext(doc);
    eraserTool.onPointerDown(ctx, { x: 2, y: 2 }, NO_MODIFIERS);

    expect(getPixel(cel.pixels, 2, 2, 4)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });
});

describe("fill", () => {
  it("bucket fills the contiguous region only", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    for (let y = 0; y < 4; y++) setPixel(cel.pixels, 2, y, 4, BLUE);

    const { ctx } = makeToolContext(doc);
    bucketTool.onPointerDown(ctx, { x: 0, y: 0 }, NO_MODIFIERS);

    expect(getPixel(cel.pixels, 1, 3, 4)).toEqual(RED);
    expect(getPixel(cel.pixels, 3, 0, 4).a).toBe(0);
  });

  it("fill-similar replaces every matching pixel", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 2, 2, 4, BLUE);

    const { ctx } = makeToolContext(doc);
    fillSimilarTool.onPointerDown(ctx, { x: 0, y: 0 }, NO_MODIFIERS);

    expect(getPixel(cel.pixels, 3, 3, 4)).toEqual(RED);
    expect(getPixel(cel.pixels, 2, 2, 4)).toEqual(BLUE);
  });

  it("records nothing when filling with the existing colour", () => {
    const doc = makeDocument();
    const { ctx, stroke } = makeToolContext(doc, { color: { r: 0, g: 0, b: 0, a: 0 } });

    bucketTool.onPointerDown(ctx, { x: 0, y: 0 }, NO_MODIFIERS);

    expect(stroke.commit()).toBeNull();
  });
});

describe("picker", () => {
  it("samples the active layer when not sampling the merged image", () => {
    const doc = makeDocument();
    setPixel(doc.ensureCel("l1", "f1").pixels, 1, 1, 4, BLUE);

    const { ctx, picked } = makeToolContext(doc);
    pickerTool.onPointerDown(ctx, { x: 1, y: 1 }, NO_MODIFIERS);

    expect(picked.color).toEqual(BLUE);
  });

  it("ignores samples outside the canvas", () => {
    const doc = makeDocument();
    const { ctx, picked } = makeToolContext(doc);

    pickerTool.onPointerDown(ctx, { x: 9, y: 9 }, NO_MODIFIERS);

    expect(picked.color).toBeNull();
  });
});
