import { describe, expect, it } from "vitest";
import { getPixel, setPixel } from "@/core/buffer";
import { StrokeRecorder } from "@/core/history";
import { TRANSPARENT } from "@/lib/color";
import { eraserTool } from "@/tools/eraser/tool";
import { bucketTool, fillSimilarTool } from "@/tools/fill/tool";
import { pencilTool } from "@/tools/pencil/tool";
import { pickerTool } from "@/tools/picker/tool";
import { BLUE, fakeHost, makeDocument, makeGesture, RED } from "@test/factories";

type PencilHost = Parameters<typeof pencilTool.onPointerDown>[0];
type EraserHost = Parameters<typeof eraserTool.onPointerDown>[0];
type PickerHost = Parameters<typeof pickerTool.onPointerDown>[0];

describe("pencil", () => {
  it("paints a single pixel on pointer down", () => {
    const doc = makeDocument();

    pencilTool.onPointerDown(fakeHost(), makeGesture(doc, { x: 1, y: 1 }));

    expect(getPixel(doc.getCel("l1", "f1")!.pixels, 1, 1, 4)).toEqual(RED);
  });

  it("paints with the secondary colour on a right-button gesture", () => {
    const doc = makeDocument();

    pencilTool.onPointerDown(fakeHost(), makeGesture(doc, { x: 1, y: 1 }, { slot: "secondary" }));

    expect(getPixel(doc.getCel("l1", "f1")!.pixels, 1, 1, 4)).toEqual(BLUE);
  });

  it("joins sampled positions with no gaps", () => {
    const doc = makeDocument();
    const host: PencilHost = fakeHost();
    const first = makeGesture(doc, { x: 0, y: 0 });

    pencilTool.onPointerDown(host, first);
    pencilTool.onPointerMove!(
      host,
      makeGesture(doc, { x: 3, y: 0 }, { previous: { x: 0, y: 0 }, surface: first.surface }),
    );

    const pixels = doc.getCel("l1", "f1")!.pixels;
    for (let x = 0; x <= 3; x++) expect(getPixel(pixels, x, 0, 4)).toEqual(RED);
  });

  it("stamps a square brush for larger sizes", () => {
    const doc = makeDocument();
    const host: PencilHost = fakeHost({ settings: { size: 2 } });

    pencilTool.onPointerDown(host, makeGesture(doc, { x: 0, y: 0 }));

    const pixels = doc.getCel("l1", "f1")!.pixels;
    expect(getPixel(pixels, 1, 1, 4)).toEqual(RED);
    expect(getPixel(pixels, 2, 2, 4).a).toBe(0);
  });

  it("clips writes at the canvas edge", () => {
    const doc = makeDocument();

    // Must not throw, and must not wrap around to the opposite edge.
    pencilTool.onPointerDown(fakeHost(), makeGesture(doc, { x: -1, y: 0 }));
    expect(getPixel(doc.ensureCel("l1", "f1").pixels, 3, 0, 4).a).toBe(0);
  });

  it("mirrors across the vertical axis when the mirror option is on", () => {
    const doc = makeDocument();
    const host: PencilHost = fakeHost({ settings: { mirrorHorizontal: true } });

    pencilTool.onPointerDown(host, makeGesture(doc, { x: 0, y: 2 }));

    const pixels = doc.getCel("l1", "f1")!.pixels;
    expect(getPixel(pixels, 0, 2, 4)).toEqual(RED);
    expect(getPixel(pixels, 3, 2, 4)).toEqual(RED);
  });
});

describe("eraser", () => {
  it("zeroes pixels rather than blending transparency over them", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 2, 2, 4, RED);

    eraserTool.onPointerDown(fakeHost(), makeGesture(doc, { x: 2, y: 2 }));

    expect(getPixel(cel.pixels, 2, 2, 4)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("erases its own brush size and never mirrors", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    cel.pixels.fill(255);
    const host: EraserHost = fakeHost({ settings: { size: 2, mirrorHorizontal: true } });

    eraserTool.onPointerDown(host, makeGesture(doc, { x: 0, y: 0 }));

    expect(getPixel(cel.pixels, 1, 1, 4).a).toBe(0);
    expect(getPixel(cel.pixels, 3, 0, 4).a).toBe(255);
  });
});

describe("fill", () => {
  it("bucket fills the contiguous region only", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    for (let y = 0; y < 4; y++) setPixel(cel.pixels, 2, y, 4, BLUE);

    bucketTool.onPointerDown(fakeHost(), makeGesture(doc, { x: 0, y: 0 }));

    expect(getPixel(cel.pixels, 1, 3, 4)).toEqual(RED);
    expect(getPixel(cel.pixels, 3, 0, 4).a).toBe(0);
  });

  it("fill-similar replaces every matching pixel", () => {
    const doc = makeDocument();
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 2, 2, 4, BLUE);

    fillSimilarTool.onPointerDown(fakeHost(), makeGesture(doc, { x: 0, y: 0 }));

    expect(getPixel(cel.pixels, 3, 3, 4)).toEqual(RED);
    expect(getPixel(cel.pixels, 2, 2, 4)).toEqual(BLUE);
  });

  it("records nothing when filling with the existing colour", () => {
    const doc = makeDocument();
    const recorder = new StrokeRecorder(doc, "Test");
    const host = fakeHost({ colors: { get: () => TRANSPARENT } });

    bucketTool.onPointerDown(host, makeGesture(doc, { x: 0, y: 0 }, { recorder }));

    expect(recorder.commit()).toBeNull();
  });
});

describe("picker", () => {
  it("samples the active layer when not sampling the merged image", () => {
    const doc = makeDocument();
    setPixel(doc.ensureCel("l1", "f1").pixels, 1, 1, 4, BLUE);
    const host: PickerHost = fakeHost({ settings: { pickFromComposite: false } });

    pickerTool.onPointerDown(host, makeGesture(doc, { x: 1, y: 1 }));

    expect(host.colors.set).toHaveBeenCalledWith("primary", BLUE);
  });

  it("samples the merged image by default", () => {
    const doc = makeDocument();
    setPixel(doc.ensureCel("l1", "f1").pixels, 1, 1, 4, BLUE);
    const host: PickerHost = fakeHost({ document: { sampleComposite: () => RED } });

    pickerTool.onPointerDown(host, makeGesture(doc, { x: 1, y: 1 }));

    expect(host.colors.set).toHaveBeenCalledWith("primary", RED);
  });

  it("writes the colour to the gesture's slot", () => {
    const doc = makeDocument();
    setPixel(doc.ensureCel("l1", "f1").pixels, 1, 1, 4, BLUE);
    const host: PickerHost = fakeHost({ settings: { pickFromComposite: false } });

    pickerTool.onPointerDown(host, makeGesture(doc, { x: 1, y: 1 }, { slot: "secondary" }));

    expect(host.colors.set).toHaveBeenCalledWith("secondary", BLUE);
  });

  it("ignores samples outside the canvas", () => {
    const doc = makeDocument();
    const host: PickerHost = fakeHost();

    pickerTool.onPointerDown(host, makeGesture(doc, { x: 9, y: 9 }));

    expect(host.colors.set).not.toHaveBeenCalled();
  });
});
