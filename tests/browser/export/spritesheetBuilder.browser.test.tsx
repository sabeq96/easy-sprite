import { expect, test } from "vitest";
import { setPixel } from "@/editor/buffer";
import type { SpritesheetBlockRecord } from "@/db/schema";
import { exportBuilderSheet } from "@/export/spritesheetBuilder";
import { renderSpriteStrip } from "@/export/spriteStrip";
import { makeDocument, RED } from "@test/factories";

test("renderSpriteStrip lays every frame out left-to-right at sprite resolution", () => {
  const doc = makeDocument({ width: 4, height: 4, frames: [{ id: "f1" }, { id: "f2" }] });
  const cel = doc.ensureCel(doc.layers[0].id, "f1");
  setPixel(cel.pixels, 0, 0, doc.width, RED);

  const strip = renderSpriteStrip(doc);

  expect(strip.width).toBe(8);
  expect(strip.height).toBe(4);
});

test("exportBuilderSheet composes every block at its stored position", async () => {
  const a = makeDocument({ id: "a", width: 4, height: 4, frames: [{ id: "f1" }] });
  const b = makeDocument({
    id: "b",
    width: 4,
    height: 4,
    frames: [{ id: "f1" }, { id: "f2" }],
  });
  const docs = new Map([
    [a.id, a],
    [b.id, b],
  ]);
  const blocks: SpritesheetBlockRecord[] = [
    { id: "block-a", spriteId: a.id, x: 0, y: 0 },
    { id: "block-b", spriteId: b.id, x: 0, y: 4 },
  ];

  const { blob, metadata } = await exportBuilderSheet(blocks, docs, { scale: 1 });

  expect(blob.type).toBe("image/png");
  expect(blob.size).toBeGreaterThan(0);
  expect(metadata.width).toBe(8); // b's two 4px frames, side by side
  expect(metadata.height).toBe(8); // a's row (4px) + b's row (4px)
  expect(metadata.blocks).toHaveLength(2);
  expect(metadata.blocks[1].frames).toHaveLength(2);
});

test("exportBuilderSheet scales every dimension", async () => {
  const doc = makeDocument({ width: 4, height: 4, frames: [{ id: "f1" }] });
  const docs = new Map([[doc.id, doc]]);
  const blocks: SpritesheetBlockRecord[] = [{ id: "block-1", spriteId: doc.id, x: 0, y: 0 }];

  const { metadata } = await exportBuilderSheet(blocks, docs, { scale: 4 });

  expect(metadata.width).toBe(16);
  expect(metadata.height).toBe(16);
});
