import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import { celKey, flushCels } from "@/db/repositories/cels";
import {
  createSprite,
  duplicateSprite,
  loadSnapshot,
  removeSprite,
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

  it("bumps updatedAt on update", async () => {
    const sprite = await createSprite();
    await new Promise((resolve) => setTimeout(resolve, 2));
    await updateSprite(sprite.id, { name: "Renamed" });

    const updated = await db.sprites.get(sprite.id);
    expect(updated?.name).toBe("Renamed");
    expect(updated!.updatedAt).toBeGreaterThan(sprite.updatedAt);
  });
});
