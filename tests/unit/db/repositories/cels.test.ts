import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import { createSprite } from "@/db/repositories/sprites";
import { celKey, flushCels, isCelEmpty } from "@/db/repositories/cels";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("cel repository", () => {
  it("detects empty buffers by alpha only", () => {
    expect(isCelEmpty(new Uint8ClampedArray([255, 255, 255, 0]))).toBe(true);
    expect(isCelEmpty(new Uint8ClampedArray([0, 0, 0, 1]))).toBe(false);
  });

  it("deletes rather than stores a fully transparent cel", async () => {
    const sprite = await createSprite({ width: 1, height: 1 });
    const write = {
      spriteId: sprite.id,
      layerId: sprite.layerIds[0],
      frameId: sprite.frames[0].id,
      pixels: new Uint8ClampedArray([255, 0, 0, 255]),
    };

    await flushCels([write]);
    expect(await db.cels.count()).toBe(1);

    await flushCels([{ ...write, pixels: new Uint8ClampedArray(4) }]);
    expect(await db.cels.count()).toBe(0);
  });

  it("copies the buffer so later drawing does not mutate the stored row", async () => {
    const sprite = await createSprite({ width: 1, height: 1 });
    const pixels = new Uint8ClampedArray([10, 20, 30, 255]);
    await flushCels([
      { spriteId: sprite.id, layerId: sprite.layerIds[0], frameId: sprite.frames[0].id, pixels },
    ]);

    pixels[0] = 99;
    const stored = await db.cels.get(celKey(sprite.layerIds[0], sprite.frames[0].id));
    expect(stored?.pixels[0]).toBe(10);
  });
});
