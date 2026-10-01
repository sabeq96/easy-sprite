import { describe, expect, it } from "vitest";
import { getPixel, setPixel } from "@/core/buffer";
import { StrokeRecorder } from "@/core/history";
import { createSurface } from "@/hooks/toolHost/surface";
import { TRANSPARENT } from "@/lib/color";
import { BLUE, makeDocument, RED } from "@test/factories";

function setup() {
  const doc = makeDocument();
  const recorder = new StrokeRecorder(doc, "Test");
  return { doc, recorder, surface: createSurface(doc, "l1", "f1", recorder) };
}

describe("surface", () => {
  it("buffer() creates the cel, and its snapshot makes undo exact", () => {
    const { doc, recorder, surface } = setup();
    expect(doc.getCel("l1", "f1")).toBeNull();

    setPixel(surface.buffer(), 1, 1, 4, RED);
    surface.commit({ x: 1, y: 1, w: 1, h: 1 });
    expect(doc.getCel("l1", "f1")).not.toBeNull();

    const command = recorder.commit()!;
    expect(command.label).toBe("Test");
    command.undo();
    expect(getPixel(doc.getCel("l1", "f1")!.pixels, 1, 1, 4).a).toBe(0);
    command.redo();
    expect(getPixel(doc.getCel("l1", "f1")!.pixels, 1, 1, 4)).toEqual(RED);
  });

  it("commit(null) and an empty rect are no-ops", () => {
    const { doc, recorder, surface } = setup();
    const changes: unknown[] = [];
    doc.events.on("pixels", (change) => changes.push(change));

    setPixel(surface.buffer(), 0, 0, 4, RED);
    surface.commit(null);
    surface.commit({ x: 0, y: 0, w: 0, h: 0 });

    expect(changes).toEqual([]);
    expect(recorder.commit()).toBeNull();
  });

  it("revert() restores every changed pixel and records nothing", () => {
    const { doc, recorder, surface } = setup();
    setPixel(doc.ensureCel("l1", "f1").pixels, 2, 2, 4, BLUE);

    const pixels = surface.buffer();
    setPixel(pixels, 2, 2, 4, RED);
    setPixel(pixels, 0, 0, 4, RED);
    surface.commit({ x: 0, y: 0, w: 3, h: 3 });

    surface.revert();

    expect(getPixel(doc.getCel("l1", "f1")!.pixels, 2, 2, 4)).toEqual(BLUE);
    expect(getPixel(doc.getCel("l1", "f1")!.pixels, 0, 0, 4).a).toBe(0);
    expect(recorder.commit()).toBeNull();
  });

  it("read() is transparent outside the sprite or with no cel", () => {
    const { doc, surface } = setup();
    expect(surface.read(1, 1)).toEqual(TRANSPARENT);

    setPixel(doc.ensureCel("l1", "f1").pixels, 1, 1, 4, RED);
    expect(surface.read(1, 1)).toEqual(RED);
    expect(surface.read(-1, 0)).toEqual(TRANSPARENT);
    expect(surface.read(4, 0)).toEqual(TRANSPARENT);
  });
});
