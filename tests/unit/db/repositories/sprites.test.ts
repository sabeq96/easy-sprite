import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import { celKey, flushCels } from "@/db/repositories/cels";
import {
  createSprite,
  duplicateSprite,
  loadSnapshot,
  removeSprite,
  splitSpriteIntoFrames,
  updateSprite,
} from "@/db/repositories/sprites";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("sprite repository", () => {
  it("creates a sprite with one layer, one frame and no cel rows", async () => {
    const sprite = await createSprite({ name: "Hero", width: 16, height: 16 });
    const snapshot = await loadSnapshot(sprite.id);

    expect(snapshot.sprite.name).toBe("Hero");
    expect(snapshot.layers).toHaveLength(1);
    expect(snapshot.sprite.frames).toHaveLength(1);
    expect(snapshot.cels).toHaveLength(0);
  });

  it("falls back to Untitled for a blank name", async () => {
    const sprite = await createSprite({ name: "   " });
    expect(sprite.name).toBe("Untitled");
  });

  it("stores the tags it is created with", async () => {
    const sprite = await createSprite({ tags: ["hero", "walk"] });
    expect((await loadSnapshot(sprite.id)).sprite.tags).toEqual(["hero", "walk"]);
  });

  it("returns layers ordered bottom to top", async () => {
    const sprite = await createSprite();
    const extra = { spriteId: sprite.id, name: "Top", opacity: 1, visible: true, locked: false };
    await db.layers.add({ ...extra, id: "layer-top" });
    await updateSprite(sprite.id, { layerIds: ["layer-top", ...sprite.layerIds] });

    const snapshot = await loadSnapshot(sprite.id);
    expect(snapshot.layers.map((layer) => layer.id)).toEqual([
      "layer-top",
      ...sprite.layerIds,
    ]);
  });

  it("duplicates without sharing ids or buffers", async () => {
    const sprite = await createSprite({ width: 2, height: 1 });
    const [layerId] = sprite.layerIds;
    const frameId = sprite.frames[0].id;
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0]);
    await flushCels([{ spriteId: sprite.id, layerId, frameId, pixels }]);

    const copy = await duplicateSprite(sprite.id);
    const snapshot = await loadSnapshot(copy.id);

    expect(copy.id).not.toBe(sprite.id);
    expect(copy.name).toBe("Untitled copy");
    expect(snapshot.layers[0].id).not.toBe(layerId);
    expect(snapshot.cels[0].id).toBe(celKey(snapshot.layers[0].id, copy.frames[0].id));
    expect(Array.from(snapshot.cels[0].pixels)).toEqual(Array.from(pixels));

    // Mutating the copy must not reach the original.
    snapshot.cels[0].pixels[0] = 1;
    const original = await loadSnapshot(sprite.id);
    expect(original.cels[0].pixels[0]).toBe(255);
  });

  it("cascades deletes to layers and cels", async () => {
    const sprite = await createSprite();
    await flushCels([
      {
        spriteId: sprite.id,
        layerId: sprite.layerIds[0],
        frameId: sprite.frames[0].id,
        pixels: new Uint8ClampedArray([1, 2, 3, 255]),
      },
    ]);

    await removeSprite(sprite.id);

    expect(await db.sprites.count()).toBe(0);
    expect(await db.layers.count()).toBe(0);
    expect(await db.cels.count()).toBe(0);
  });

  it("splits a sprite into a grid of frames, left to right then top to bottom", async () => {
    const sprite = await createSprite({ width: 4, height: 2 });
    const [layerId] = sprite.layerIds;
    const frameId = sprite.frames[0].id;

    // Left half (x: 0-1) red, right half (x: 2-3) blue, across both rows.
    const pixels = new Uint8ClampedArray(4 * 2 * 4);
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 4; x++) {
        const index = (y * 4 + x) * 4;
        const [r, g, b] = x < 2 ? [255, 0, 0] : [0, 0, 255];
        pixels.set([r, g, b, 255], index);
      }
    }
    await flushCels([{ spriteId: sprite.id, layerId, frameId, pixels }]);

    const updated = await splitSpriteIntoFrames(sprite.id, 2, 2);

    expect(updated.width).toBe(2);
    expect(updated.height).toBe(2);
    expect(updated.frames).toHaveLength(2);
    expect(updated.thumbnail).toBeNull();

    const snapshot = await loadSnapshot(sprite.id);
    const byFrame = new Map(snapshot.cels.map((cel) => [cel.frameId, cel]));
    const leftCel = byFrame.get(updated.frames[0].id)!;
    const rightCel = byFrame.get(updated.frames[1].id)!;
    expect(Array.from(leftCel.pixels)).toEqual([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255]);
    expect(Array.from(rightCel.pixels)).toEqual([0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255]);
  });

  it("drops tiles that end up fully transparent", async () => {
    const sprite = await createSprite({ width: 4, height: 2 });
    const [layerId] = sprite.layerIds;
    const frameId = sprite.frames[0].id;

    const pixels = new Uint8ClampedArray(4 * 2 * 4);
    for (let y = 0; y < 2; y++) {
      pixels.set([255, 0, 0, 255], (y * 4 + 0) * 4);
      pixels.set([255, 0, 0, 255], (y * 4 + 1) * 4);
      // Right half stays fully transparent.
    }
    await flushCels([{ spriteId: sprite.id, layerId, frameId, pixels }]);

    await splitSpriteIntoFrames(sprite.id, 2, 2);
    const snapshot = await loadSnapshot(sprite.id);

    expect(snapshot.sprite.frames).toHaveLength(2);
    expect(snapshot.cels).toHaveLength(1);
  });

  it("rejects a frame size larger than the sprite", async () => {
    const sprite = await createSprite({ width: 4, height: 4 });
    await expect(splitSpriteIntoFrames(sprite.id, 8, 8)).rejects.toThrow();
  });

  it("bumps updatedAt on update", async () => {
    const sprite = await createSprite();
    await new Promise((resolve) => setTimeout(resolve, 2));
    await updateSprite(sprite.id, { name: "Renamed" });

    const updated = await db.sprites.get(sprite.id);
    expect(updated?.name).toBe("Renamed");
    expect(updated!.updatedAt).toBeGreaterThan(sprite.updatedAt);
  });
});
