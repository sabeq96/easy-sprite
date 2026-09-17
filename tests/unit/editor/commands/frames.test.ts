import { describe, expect, it } from "vitest";
import { getPixel, setPixel } from "@/editor/buffer";
import {
  addFrameCommand,
  duplicateFrameCommand,
  moveFrameCommand,
  removeFrameCommand,
  setFpsCommand,
} from "@/editor/commands/frames";
import { BLUE, makeDocument, RED } from "@test/factories";

describe("frame commands", () => {
  it("adds after the active frame", () => {
    const doc = makeDocument();
    doc.addFrame();
    const command = addFrameCommand(doc, "f1");

    expect(doc.frames).toHaveLength(3);
    expect(doc.frameIndex("f1")).toBe(0);

    command.undo();
    expect(doc.frames).toHaveLength(2);
  });

  it("duplicates every layer's pixels independently", () => {
    const doc = makeDocument();
    const second = doc.addLayer("Second");
    setPixel(doc.ensureCel("l1", "f1").pixels, 0, 0, 4, RED);
    setPixel(doc.ensureCel(second.id, "f1").pixels, 1, 1, 4, BLUE);

    duplicateFrameCommand(doc, "f1");
    const copy = doc.frames[1];

    expect(getPixel(doc.getCel("l1", copy.id)!.pixels, 0, 0, 4)).toEqual(RED);
    expect(getPixel(doc.getCel(second.id, copy.id)!.pixels, 1, 1, 4)).toEqual(BLUE);

    setPixel(doc.getCel("l1", copy.id)!.pixels, 0, 0, 4, BLUE);
    expect(getPixel(doc.getCel("l1", "f1")!.pixels, 0, 0, 4)).toEqual(RED);
  });

  it("restores a deleted frame's pixels", () => {
    const doc = makeDocument();
    const second = doc.addFrame();
    setPixel(doc.ensureCel("l1", second.id).pixels, 2, 2, 4, RED);

    const command = removeFrameCommand(doc, second.id)!;
    expect(doc.frames).toHaveLength(1);

    command.undo();
    expect(getPixel(doc.getCel("l1", second.id)!.pixels, 2, 2, 4)).toEqual(RED);
  });

  it("refuses to delete the only frame", () => {
    const doc = makeDocument();
    expect(removeFrameCommand(doc, "f1")).toBeNull();
  });

  it("reorders and reverses", () => {
    const doc = makeDocument();
    const second = doc.addFrame();
    const command = moveFrameCommand(doc, 0, 1)!;

    expect(doc.frames.map((frame) => frame.id)).toEqual([second.id, "f1"]);
    command.undo();
    expect(doc.frames.map((frame) => frame.id)).toEqual(["f1", second.id]);
  });

  it("changes fps and returns null for a no-op", () => {
    const doc = makeDocument();
    const command = setFpsCommand(doc, 24)!;
    expect(doc.fps).toBe(24);

    command.undo();
    expect(doc.fps).toBe(12);
    expect(setFpsCommand(doc, 12)).toBeNull();
  });
});
