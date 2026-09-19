import { describe, expect, it } from "vitest";
import { makeDocument } from "@test/factories";
import type { SpritesheetBlockRecord } from "@/db/schema";
import {
  blockRect,
  computeBuilderBounds,
  findFreePosition,
} from "@/export/spritesheetBuilderLayout";

describe("spritesheet builder layout", () => {
  it("computes a block's rect as its frame strip", () => {
    const doc = makeDocument({ width: 8, height: 8, frames: [{ id: "f1" }, { id: "f2" }] });
    const block: SpritesheetBlockRecord = { id: "b1", spriteId: doc.id, x: 16, y: 8 };
    expect(blockRect(block, doc)).toEqual({ x: 16, y: 8, w: 16, h: 8 });
  });

  it("bounds the composition to the furthest block edge", () => {
    const a = makeDocument({ id: "a", width: 8, height: 8, frames: [{ id: "f1" }] });
    const b = makeDocument({
      id: "b",
      width: 8,
      height: 8,
      frames: [{ id: "f1" }, { id: "f2" }],
    });
    const docs = new Map([
      [a.id, a],
      [b.id, b],
    ]);
    const blocks: SpritesheetBlockRecord[] = [
      { id: "block-a", spriteId: a.id, x: 0, y: 0 },
      { id: "block-b", spriteId: b.id, x: 8, y: 8 },
    ];
    expect(computeBuilderBounds(blocks, docs)).toEqual({ width: 24, height: 16 });
  });

  it("ignores blocks whose document has not resolved yet", () => {
    const doc = makeDocument({ id: "a", width: 4, height: 4 });
    const blocks: SpritesheetBlockRecord[] = [
      { id: "b1", spriteId: doc.id, x: 0, y: 0 },
      { id: "b2", spriteId: "missing", x: 100, y: 100 },
    ];
    expect(computeBuilderBounds(blocks, new Map([[doc.id, doc]]))).toEqual({
      width: 4,
      height: 4,
    });
  });

  it("places the first block at the origin", () => {
    expect(findFreePosition([], { w: 8, h: 8 })).toEqual({ x: 0, y: 0 });
  });

  it("skips over an occupied cell to find the next free one", () => {
    const existing = [{ x: 0, y: 0, w: 8, h: 8 }];
    const position = findFreePosition(existing, { w: 8, h: 8 }, 8);
    expect(existing.some((rect) => rect.x === position.x && rect.y === position.y)).toBe(false);
  });

  it("never returns a position that overlaps an existing block", () => {
    const existing = [
      { x: 0, y: 0, w: 8, h: 8 },
      { x: 8, y: 0, w: 8, h: 8 },
      { x: 0, y: 8, w: 16, h: 8 },
    ];
    const { x, y } = findFreePosition(existing, { w: 8, h: 8 }, 8);
    const candidate = { x, y, w: 8, h: 8 };
    const overlaps = existing.some(
      (rect) =>
        candidate.x < rect.x + rect.w &&
        candidate.x + candidate.w > rect.x &&
        candidate.y < rect.y + rect.h &&
        candidate.y + candidate.h > rect.y,
    );
    expect(overlaps).toBe(false);
  });
});
