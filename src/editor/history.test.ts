import { describe, expect, it } from "vitest";
import { setPixel } from "@/editor/buffer";
import { History, StrokeRecorder, type Command } from "@/editor/history";
import { makeDocument, RED } from "@/test/factories";

function noopCommand(label: string, sizeBytes = 0): Command {
  return { label, sizeBytes, undo() {}, redo() {} };
}

describe("StrokeRecorder", () => {
  it("restores the exact buffer on undo and reapplies on redo", () => {
    const doc = makeDocument();
    const history = new History();
    const recorder = new StrokeRecorder(doc, "Pencil");

    recorder.touch("l1", "f1");
    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 1, 1, doc.width, RED);
    recorder.extend("l1", "f1", { x: 1, y: 1, w: 1, h: 1 });
    doc.markPixelsChanged(cel, { x: 1, y: 1, w: 1, h: 1 });

    const command = recorder.commit();
    expect(command).not.toBeNull();
    history.push(command!);

    history.undo();
    expect(Array.from(cel.pixels)).toEqual(Array.from(new Uint8ClampedArray(4 * 4 * 4)));

    history.redo();
    expect(cel.pixels[(1 * 4 + 1) * 4]).toBe(255);
  });

  it("returns null for a stroke that changed nothing", () => {
    const doc = makeDocument();
    const recorder = new StrokeRecorder(doc, "Pencil");
    recorder.touch("l1", "f1");
    doc.ensureCel("l1", "f1");
    recorder.extend("l1", "f1", { x: 0, y: 0, w: 2, h: 2 });
    expect(recorder.commit()).toBeNull();
  });

  it("records only the union rect, not the whole canvas", () => {
    const doc = makeDocument({ width: 64, height: 64 });
    const recorder = new StrokeRecorder(doc, "Pencil");
    recorder.touch("l1", "f1");

    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 10, 10, doc.width, RED);
    recorder.extend("l1", "f1", { x: 10, y: 10, w: 1, h: 1 });

    const command = recorder.commit()!;
    // 1px before + after = 8 bytes, versus 16 KB for a full-canvas snapshot.
    expect(command.sizeBytes).toBe(8);
  });

  it("clamps an out-of-bounds dirty rect", () => {
    const doc = makeDocument();
    const recorder = new StrokeRecorder(doc, "Pencil");
    recorder.touch("l1", "f1");

    const cel = doc.ensureCel("l1", "f1");
    setPixel(cel.pixels, 3, 3, doc.width, RED);
    recorder.extend("l1", "f1", { x: 2, y: 2, w: 10, h: 10 });

    const command = recorder.commit();
    expect(command).not.toBeNull();
    command!.undo();
    expect(cel.pixels[(3 * 4 + 3) * 4 + 3]).toBe(0);
  });

  it("spans multiple cels in one stroke", () => {
    const doc = makeDocument();
    doc.addFrame();
    const recorder = new StrokeRecorder(doc, "Move");

    for (const frameId of ["f1", doc.frames[1].id]) {
      recorder.touch("l1", frameId);
      const cel = doc.ensureCel("l1", frameId);
      setPixel(cel.pixels, 0, 0, doc.width, RED);
      recorder.extend("l1", frameId, { x: 0, y: 0, w: 1, h: 1 });
    }

    const command = recorder.commit()!;
    command.undo();
    expect(doc.getCel("l1", "f1")!.pixels[3]).toBe(0);
    expect(doc.getCel("l1", doc.frames[1].id)!.pixels[3]).toBe(0);
  });
});

describe("History", () => {
  it("clears the redo stack on a new push", () => {
    const history = new History();
    history.push(noopCommand("a"));
    history.undo();
    expect(history.canRedo).toBe(true);

    history.push(noopCommand("b"));
    expect(history.canRedo).toBe(false);
  });

  it("drops the oldest entries past the cap", () => {
    const history = new History();
    for (let index = 0; index < 120; index++) history.push(noopCommand(`edit-${index}`));

    let depth = 0;
    while (history.canUndo) {
      history.undo();
      depth++;
    }
    expect(depth).toBe(100);
  });

  it("bumps its revision on every change", () => {
    const history = new History();
    const start = history.revision;
    history.push(noopCommand("a"));
    history.undo();
    history.redo();
    expect(history.revision).toBe(start + 3);
  });

  it("exposes labels for the UI", () => {
    const history = new History();
    history.push(noopCommand("Pencil"));
    expect(history.undoLabel).toBe("Pencil");
    history.undo();
    expect(history.redoLabel).toBe("Pencil");
  });
});
