import { describe, expect, it } from "vitest";
import { resizeCanvasCommand } from "@/editor/commands/canvas";
import { makeDocument } from "@test/factories";

describe("resizeCanvasCommand", () => {
  it("sets the new tile with the new size, and undo restores both", () => {
    const doc = makeDocument({ width: 16, height: 16, tileSize: 8 });
    const command = resizeCanvasCommand(doc, 32, 16, {}, 16)!;

    expect([doc.width, doc.height, doc.tileSize]).toEqual([32, 16, 16]);
    command.undo();
    expect([doc.width, doc.height, doc.tileSize]).toEqual([16, 16, 8]);
    command.redo();
    expect([doc.width, doc.height, doc.tileSize]).toEqual([32, 16, 16]);
  });

  it("keeps the tile when none is given", () => {
    const doc = makeDocument({ width: 16, height: 16, tileSize: 8 });
    resizeCanvasCommand(doc, 24, 24);
    expect(doc.tileSize).toBe(8);
  });

  it("changing only the tile is its own undoable command", () => {
    const doc = makeDocument({ width: 48, height: 48, tileSize: 16 });
    const command = resizeCanvasCommand(doc, 48, 48, {}, 24)!;

    expect(command.label).toBe("Change tile size");
    expect(doc.tileSize).toBe(24);
    command.undo();
    expect(doc.tileSize).toBe(16);
  });

  it("undo clears a tile the sprite never had", () => {
    const doc = makeDocument({ width: 20, height: 20 });
    const command = resizeCanvasCommand(doc, 24, 24, {}, 8)!;
    command.undo();
    expect(doc.tileSize).toBeUndefined();
  });

  it("is a no-op when neither size nor tile changes", () => {
    const doc = makeDocument({ width: 16, height: 16, tileSize: 8 });
    expect(resizeCanvasCommand(doc, 16, 16, {}, 8)).toBeNull();
  });
});
