import { expect, test, vi } from "vitest";
import { setPixel } from "@/editor/buffer";
import type { SpritesheetBlockRecord } from "@/db/schema";
import { downloadBuilderSheetPng, renderBuilderSheet } from "@/export/spritesheetBuilder";
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

test("renderBuilderSheet composes every block at its packed position, at 1×", () => {
  const a = makeDocument({ id: "a", width: 4, height: 4, frames: [{ id: "f1" }] });
  const b = makeDocument({
    id: "b",
    width: 4,
    height: 4,
    frames: [{ id: "f1" }, { id: "f2" }],
  });
  setPixel(b.ensureCel(b.layers[0].id, "f1").pixels, 0, 0, b.width, RED);
  const docs = new Map([
    [a.id, a],
    [b.id, b],
  ]);
  const blocks: SpritesheetBlockRecord[] = [
    { id: "block-a", spriteId: a.id, row: 0 },
    { id: "block-b", spriteId: b.id, row: 1 },
  ];

  const sheet = renderBuilderSheet(blocks, docs);

  expect(sheet.width).toBe(8); // b's two 4px frames, side by side
  expect(sheet.height).toBe(8); // a's row (4px) + b's row (4px)
  // b's first pixel lands at the start of the second row.
  expect([...sheet.getContext("2d")!.getImageData(0, 4, 1, 1).data]).toEqual([255, 0, 0, 255]);
});

test("downloadBuilderSheetPng downloads the sheet as <name>.png", async () => {
  const doc = makeDocument({ width: 4, height: 4, frames: [{ id: "f1" }] });
  const docs = new Map([[doc.id, doc]]);
  const blocks: SpritesheetBlockRecord[] = [{ id: "block-1", spriteId: doc.id, row: 0 }];
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  expect(await downloadBuilderSheetPng("Enemies", blocks, docs)).toBe("Enemies.png");
  const [blob] = createObjectURL.mock.calls[0] as [Blob];
  expect(blob.type).toBe("image/png");
  expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe("Enemies.png");

  createObjectURL.mockRestore();
  click.mockRestore();
});
