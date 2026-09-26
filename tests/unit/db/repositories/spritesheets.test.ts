import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import { createSprite, removeSprite } from "@/db/repositories/sprites";
import {
  createSpritesheet,
  getSpritesheet,
  listSpritesheets,
  removeSpritesheet,
  updateSpritesheet,
} from "@/db/repositories/spritesheets";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("spritesheet repository", () => {
  it("creates a spritesheet with no blocks", async () => {
    const sheet = await createSpritesheet({ name: "Enemies" });
    expect(sheet.name).toBe("Enemies");
    expect(sheet.blocks).toEqual([]);
  });

  it("stores its tile size, defaulting to 16", async () => {
    expect((await getSpritesheet((await createSpritesheet({ tileSize: 32 })).id)).tileSize).toBe(32);
    expect((await createSpritesheet()).tileSize).toBe(16);
  });

  it("falls back to Untitled for a blank name", async () => {
    const sheet = await createSpritesheet({ name: "   " });
    expect(sheet.name).toBe("Untitled");
  });

  it("stores the tags it is created with", async () => {
    const sheet = await createSpritesheet({ tags: ["ui"] });
    expect((await getSpritesheet(sheet.id)).tags).toEqual(["ui"]);
  });

  it("lists spritesheets newest-updated first", async () => {
    const first = await createSpritesheet({ name: "First" });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await createSpritesheet({ name: "Second" });

    const listed = await listSpritesheets();
    expect(listed.map((sheet) => sheet.id)).toEqual([second.id, first.id]);
  });

  it("throws for a missing id", async () => {
    await expect(getSpritesheet("missing")).rejects.toThrow();
  });

  it("bumps updatedAt and persists a patch", async () => {
    const sheet = await createSpritesheet();
    await new Promise((resolve) => setTimeout(resolve, 2));
    await updateSpritesheet(sheet.id, { name: "Renamed" });

    const updated = await getSpritesheet(sheet.id);
    expect(updated.name).toBe("Renamed");
    expect(updated.updatedAt).toBeGreaterThan(sheet.updatedAt);
  });

  it("deletes a spritesheet", async () => {
    const sheet = await createSpritesheet();
    await removeSpritesheet(sheet.id);
    expect(await db.spritesheets.count()).toBe(0);
  });

  it("strips a deleted sprite's blocks from any spritesheet referencing it", async () => {
    const sprite = await createSprite({ name: "Hero" });
    const other = await createSprite({ name: "Villain" });
    const sheet = await createSpritesheet({ name: "Scene" });
    await updateSpritesheet(sheet.id, {
      blocks: [
        { id: "block-1", spriteId: sprite.id, row: 0 },
        { id: "block-2", spriteId: other.id, row: 1 },
      ],
    });

    await removeSprite(sprite.id);

    // Hero was alone in row 0, so that row collapses rather than leaving a gap above Villain.
    const after = await getSpritesheet(sheet.id);
    expect(after.blocks).toEqual([{ id: "block-2", spriteId: other.id, row: 0 }]);
  });
});
