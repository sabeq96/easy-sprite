import { describe, expect, it, vi } from "vitest";
import { setBlocksCommand, setTileSizeCommand } from "@/editor/commands/spritesheet";
import { SpritesheetDocument } from "@/editor/spritesheetDocument";

const A = { id: "a", spriteId: "s1", row: 0 };
const B = { id: "b", spriteId: "s2", row: 0 };

function makeSheet() {
  return new SpritesheetDocument({ id: "sheet", name: "Sheet", tileSize: 16, blocks: [A, B] });
}

describe("SpritesheetDocument", () => {
  it("emits and bumps its revision on each change", () => {
    const doc = makeSheet();
    const onBlocks = vi.fn();
    doc.events.on("blocks", onBlocks);

    doc.setBlocks([B, A]);
    expect(onBlocks).toHaveBeenCalledTimes(1);
    expect(doc.revisions.blocks).toBe(1);

    doc.setMeta({ tileSize: 32 });
    expect([doc.tileSize, doc.revisions.meta]).toEqual([32, 1]);
  });
});

describe("spritesheet commands", () => {
  it("setBlocksCommand applies, undoes and redoes a layout", () => {
    const doc = makeSheet();
    const command = setBlocksCommand(doc, [B, { ...A, row: 1 }], "Move sprite")!;

    expect(command.label).toBe("Move sprite");
    expect(doc.blocks.map((block) => block.id)).toEqual(["b", "a"]);
    command.undo();
    expect(doc.blocks).toEqual([A, B]);
    command.redo();
    expect(doc.blocks[1].row).toBe(1);
  });

  it("setBlocksCommand is null when the layout is unchanged", () => {
    const doc = makeSheet();
    expect(setBlocksCommand(doc, [{ ...A }, { ...B }], "Move sprite")).toBeNull();
    expect(doc.revisions.blocks).toBe(0);
  });

  it("setTileSizeCommand applies and undoes, and is null for the same tile", () => {
    const doc = makeSheet();
    expect(setTileSizeCommand(doc, 16)).toBeNull();

    const command = setTileSizeCommand(doc, 48)!;
    expect(doc.tileSize).toBe(48);
    command.undo();
    expect(doc.tileSize).toBe(16);
  });
});
