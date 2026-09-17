import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import { createSprite } from "@/db/repositories/sprites";
import { flushCels, getCel, isCelEmpty, removeCelsForFrame } from "@/db/repositories/cels";

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
    const stored = await getCel(sprite.layerIds[0], sprite.frames[0].id);
    expect(stored?.pixels[0]).toBe(10);
  });

  it("removes every cel of a frame", async () => {
    const sprite = await createSprite({ width: 1, height: 1 });
    const frameId = sprite.frames[0].id;
    await flushCels([
      { spriteId: sprite.id, layerId: "a", frameId, pixels: new Uint8ClampedArray([1, 1, 1, 255]) },
      { spriteId: sprite.id, layerId: "b", frameId, pixels: new Uint8ClampedArray([2, 2, 2, 255]) },
    ]);

    await removeCelsForFrame(frameId);
    expect(await db.cels.count()).toBe(0);
  });
});
