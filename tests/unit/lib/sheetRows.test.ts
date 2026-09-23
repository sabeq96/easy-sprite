import { describe, expect, it } from "vitest";
import type { SpritesheetBlockRecord } from "@/db/schema";
import {
  appendToRow,
  draftToRows,
  dropBlock,
  fromRows,
  insertRow,
  placeBeside,
  placeBlock,
  rowOfBlock,
  toRowDraft,
  toRows,
  withNewRow,
  withoutBlock,
} from "@/lib/sheetRows";

const blocks = (spec: [string, number][]): SpritesheetBlockRecord[] =>
  spec.map(([id, row]) => ({ id, spriteId: `s-${id}`, row }));

const shape = (list: SpritesheetBlockRecord[]) => list.map((block) => [block.id, block.row]);

describe("sheet rows", () => {
  it("groups blocks by row, keeping their order within a row", () => {
    const rows = toRows(blocks([["a", 0], ["b", 1], ["c", 0]]));
    expect(rows.map((row) => row.map((block) => block.id))).toEqual([["a", "c"], ["b"]]);
  });

  it("drops empty rows and renumbers the rest when flattening", () => {
    const [a, b] = blocks([["a", 0], ["b", 2]]);
    expect(shape(fromRows([[a], [], [b]]))).toEqual([["a", 0], ["b", 1]]);
  });

  it("keeps the identity of a block whose row did not change", () => {
    const list = blocks([["a", 0], ["b", 1]]);
    expect(fromRows(toRows(list))[0]).toBe(list[0]);
  });

  it("collapses an emptied row and pulls the rows below it up", () => {
    expect(shape(dropBlock(blocks([["a", 0], ["b", 1], ["c", 2]]), "b"))).toEqual([
      ["a", 0],
      ["c", 1],
    ]);
  });

  it("never leaves a gap when a block is placed in a row beyond the last one", () => {
    const next = placeBlock(blocks([["a", 0]]), { id: "b", spriteId: "s-b", row: 0 }, { row: 5, index: 0 });
    expect(shape(next)).toEqual([["a", 0], ["b", 1]]);
  });

  it("moves the only block of row 0 into the trailing row without leaving row 0 blank", () => {
    const [block] = blocks([["a", 0]]);
    expect(shape(placeBlock([block], block, { row: 1, index: 0 }))).toEqual([["a", 0]]);
  });

  it("inserts a row in the middle, pushing the rows below down", () => {
    const next = insertRow(blocks([["a", 0], ["b", 1]]), { id: "c", spriteId: "s-c", row: 0 }, 1);
    expect(shape(next)).toEqual([["a", 0], ["c", 1], ["b", 2]]);
  });

  it("moves a block to a new row of its own, collapsing the one it left", () => {
    const list = blocks([["a", 0], ["b", 1]]);
    expect(shape(insertRow(list, list[1], 0))).toEqual([["b", 0], ["a", 1]]);
  });

  it("reorders within a row", () => {
    const list = blocks([["a", 0], ["b", 0], ["c", 0]]);
    expect(placeBlock(list, list[0], { row: 0, index: 2 }).map((block) => block.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});

describe("row drafts", () => {
  const list = blocks([["a", 0], ["b", 0], ["c", 1]]);

  it("keys rows by position and always ends with an empty trailing row", () => {
    expect(toRowDraft(list)).toEqual({ "row-0": ["a", "b"], "row-1": ["c"], "row-2": [] });
    expect(toRowDraft([])).toEqual({ "row-0": [] });
  });

  it("keeps an emptied row in the draft, and collapses it once committed", () => {
    const draft = appendToRow(toRowDraft(list), "c", "row-0");
    expect(draft).toEqual({ "row-0": ["a", "b", "c"], "row-1": [], "row-2": [] });
    const lookup = new Map(list.map((block) => [block.id, block]));
    expect(shape(fromRows(draftToRows(draft, lookup)))).toEqual([["a", 0], ["b", 0], ["c", 0]]);
  });

  it("places a block before or after a neighbour, and is a no-op when it already sits there", () => {
    const draft = toRowDraft(list);
    expect(placeBeside(draft, "c", "a", false)["row-0"]).toEqual(["c", "a", "b"]);
    expect(placeBeside(draft, "c", "a", true)["row-0"]).toEqual(["a", "c", "b"]);
    expect(placeBeside(draft, "b", "a", true)).toBe(draft);
    expect(appendToRow(draft, "b", "row-0")).toBe(draft);
  });

  it("adds a block that was not in the draft yet — a sprite being dragged in", () => {
    expect(appendToRow(toRowDraft(list), "new", "row-2")["row-2"]).toEqual(["new"]);
  });

  it("opens a new row above the one at the given index", () => {
    expect(withNewRow(toRowDraft(list), "c", 0)).toEqual({
      "row-0": ["c"],
      "row-1": ["a", "b"],
      "row-2": [],
      "row-3": [],
    });
  });

  it("finds the row a block is in", () => {
    expect(rowOfBlock(toRowDraft(list), "c")).toBe("row-1");
    expect(withoutBlock(toRowDraft(list), "missing")).toEqual(toRowDraft(list));
  });
});

describe("blocks stored before rows existed", () => {
  it("collapse into the first row instead of failing", () => {
    const legacy = [
      { id: "a", spriteId: "s-a", x: 0, y: 0 },
      { id: "b", spriteId: "s-b", x: 16, y: 8 },
    ] as unknown as SpritesheetBlockRecord[];
    expect(shape(fromRows(toRows(legacy)))).toEqual([["a", 0], ["b", 0]]);
  });
});
