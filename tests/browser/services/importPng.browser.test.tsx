import { expect, test } from "vitest";
import { MAX_CANVAS_SIZE } from "@/constants/canvas";
import { db } from "@/db/db";
import { importPngFiles } from "@/services/importPng";

async function pngFile(name: string, width: number, height: number, alpha = 255): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `rgba(255, 0, 0, ${alpha / 255})`;
  ctx.fillRect(0, 0, width, height);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
  return new File([blob], name, { type: "image/png" });
}

test("imports a PNG as a sprite sized to the image and named after the file", async () => {
  const file = await pngFile("hero.png", 4, 6);

  const { imported, skipped } = await importPngFiles([file]);

  expect(skipped).toEqual([]);
  expect(imported).toHaveLength(1);
  expect(imported[0].name).toBe("hero");
  expect(imported[0].width).toBe(4);
  expect(imported[0].height).toBe(6);
  expect(imported[0].thumbnail).not.toBeNull();

  const layers = await db.layers.where("spriteId").equals(imported[0].id).toArray();
  expect(layers).toHaveLength(1);

  const cels = await db.cels.where("spriteId").equals(imported[0].id).toArray();
  expect(cels).toHaveLength(1);
  expect(cels[0].pixels.length).toBe(4 * 6 * 4);
  expect(Array.from(cels[0].pixels.slice(0, 4))).toEqual([255, 0, 0, 255]);
});

test("imports several files at once, continuing past a bad one", async () => {
  const good = await pngFile("a.png", 2, 2);
  const notPng = new File(["not a png"], "notes.txt", { type: "text/plain" });
  const other = await pngFile("b.png", 3, 3);

  const { imported, skipped } = await importPngFiles([good, notPng, other]);

  expect(imported.map((sprite) => sprite.name).sort()).toEqual(["a", "b"]);
  expect(skipped).toEqual([{ name: "notes.txt", reason: "Not a PNG file" }]);
});

test("rejects a PNG larger than the max canvas size instead of resizing it", async () => {
  const tooBig = await pngFile("giant.png", MAX_CANVAS_SIZE + 1, MAX_CANVAS_SIZE + 1);

  const { imported, skipped } = await importPngFiles([tooBig]);

  expect(imported).toEqual([]);
  expect(skipped).toHaveLength(1);
  expect(skipped[0].name).toBe("giant.png");
  expect(skipped[0].reason).toContain("max canvas size");
});

test("skips writing a cel for a fully transparent import", async () => {
  const file = await pngFile("blank.png", 2, 2, 0);

  const { imported } = await importPngFiles([file]);

  const cels = await db.cels.where("spriteId").equals(imported[0].id).toArray();
  expect(cels).toHaveLength(0);
});
