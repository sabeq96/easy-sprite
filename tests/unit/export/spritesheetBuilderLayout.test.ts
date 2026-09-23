import { describe, expect, it } from "vitest";
import { makeDocument } from "@test/factories";
import type { SpritesheetBlockRecord } from "@/db/schema";
import { computeBuilderBounds, packSheet, sizesFromDocs } from "@/export/spritesheetBuilderLayout";

const sizes = new Map([
  ["wide", { w: 32, h: 8 }],
  ["tall", { w: 8, h: 16 }],
  ["small", { w: 8, h: 8 }],
]);

const block = (id: string, spriteId: string, row: number): SpritesheetBlockRecord => ({
  id,
  spriteId,
  row,
});

describe("spritesheet builder layout", () => {
  it("sizes a block as its sprite's frames laid out in one strip", () => {
    const doc = makeDocument({ width: 8, height: 8, frames: [{ id: "f1" }, { id: "f2" }] });
    expect(sizesFromDocs(new Map([[doc.id, doc]])).get(doc.id)).toEqual({ w: 16, h: 8 });
  });

  it("lays a row out left to right with no column gap", () => {
    const sheet = packSheet([block("a", "small", 0), block("b", "wide", 0)], sizes);
    expect(sheet.blocks.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 0, y: 0 },
      { x: 8, y: 0 },
    ]);
    expect(sheet.width).toBe(40);
  });

  it("starts a row directly below the tallest block of the row above", () => {
    const sheet = packSheet(
      [block("a", "tall", 0), block("b", "small", 0), block("c", "small", 1)],
      sizes,
    );
    expect(sheet.blocks.at(-1)).toMatchObject({ id: "c", x: 0, y: 16 });
    expect(sheet.rows.map((row) => row.h)).toEqual([16, 8]);
    expect(sheet.height).toBe(24);
  });

  it("bounds the sheet to its widest row and total height", () => {
    const blocks = [block("a", "wide", 0), block("b", "small", 1), block("c", "small", 1)];
    expect(computeBuilderBounds(blocks, sizes)).toEqual({ width: 32, height: 16 });
  });

  it("skips a sprite whose size is not known yet without shifting the rest", () => {
    const sheet = packSheet([block("a", "missing", 0), block("b", "small", 0)], sizes);
    expect(sheet.blocks).toEqual([{ id: "b", spriteId: "small", row: 0, x: 0, y: 0, w: 8, h: 8 }]);
  });

  it("is empty for an empty sheet", () => {
    expect(packSheet([], sizes)).toEqual({ blocks: [], rows: [], width: 0, height: 0 });
  });
});
