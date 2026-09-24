import { expect, test, vi } from "vitest";
import { pngFilename } from "@/export/download";
import { downloadSpritePng, exportSpritePng } from "@/export/spritePng";
import { makeDocument } from "@test/factories";

test("exportSpritePng is a 1× horizontal strip of every frame", async () => {
  const doc = makeDocument({ width: 4, height: 4, frames: [{ id: "f1" }, { id: "f2" }] });

  const blob = await exportSpritePng(doc);
  const bitmap = await createImageBitmap(blob);

  expect(blob.type).toBe("image/png");
  expect(bitmap.width).toBe(8);
  expect(bitmap.height).toBe(4);
});

test("the file is named after the item", () => {
  expect(pngFilename("Hero Walk")).toBe("Hero Walk.png");
  expect(pngFilename("  ")).toBe("Untitled.png");
});

test("downloadSpritePng downloads the PNG as <sprite name>.png", async () => {
  const doc = makeDocument({ width: 8, height: 8 });
  doc.name = "Hero";
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  const filename = await downloadSpritePng(doc);

  expect(filename).toBe("Hero.png");
  const [blob] = createObjectURL.mock.calls[0] as [Blob];
  expect(blob.type).toBe("image/png");
  const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
  expect(anchor.download).toBe("Hero.png");

  createObjectURL.mockRestore();
  click.mockRestore();
});
