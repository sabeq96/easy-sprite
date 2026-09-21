import { beforeEach, describe, expect, it } from "vitest";
import { STARTER_PALETTES } from "@/constants/palettes";
import { db } from "@/db/db";
import { clearAllData, exportBackup, importBackup, validateBackup } from "@/db/backup";
import { flushCels } from "@/db/repositories/cels";
import { createPalette } from "@/db/repositories/palettes";
import { createSprite, loadSnapshot } from "@/db/repositories/sprites";
import { createSpritesheet } from "@/db/repositories/spritesheets";
import { writeSetting } from "@/db/repositories/settings";
import { seedDatabase } from "@/db/seed";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function seedLibrary() {
  const sprite = await createSprite({ name: "Hero", width: 4, height: 4 });
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  pixels.set([255, 128, 64, 200], 0);

  await flushCels([
    {
      spriteId: sprite.id,
      layerId: sprite.layerIds[0],
      frameId: sprite.frames[0].id,
      pixels,
    },
  ]);
  await createPalette("Mine", ["#ff0000", "#00ff00"]);
  await writeSetting("view.grid", false);

  return sprite;
}

describe("backup", () => {
  it("round-trips a library byte-for-byte", async () => {
    const sprite = await seedLibrary();
    const backup = await exportBackup();

    await clearAllData();
    expect(await db.sprites.count()).toBe(0);

    const result = await importBackup(backup, "replace");
    expect(result.ok).toBe(true);

    const restored = await loadSnapshot(sprite.id);
    expect(restored.sprite.name).toBe("Hero");
    expect(restored.layers).toHaveLength(1);
    expect(Array.from(restored.cels[0].pixels.slice(0, 4))).toEqual([255, 128, 64, 200]);
    expect((await db.palettes.where("name").equals("Mine").toArray())[0].colors).toEqual([
      "#ff0000",
      "#00ff00",
    ]);
    expect((await db.settings.get("view.grid"))?.value).toBe(false);
  });

  it("compresses cel data rather than storing raw arrays", async () => {
    await createSprite({ width: 32, height: 32 }).then(async (sprite) => {
      await flushCels([
        {
          spriteId: sprite.id,
          layerId: sprite.layerIds[0],
          frameId: sprite.frames[0].id,
          pixels: new Uint8ClampedArray(32 * 32 * 4).fill(255),
        },
      ]);
    });

    const backup = await exportBackup();
    // 4 KB of uniform pixels must compress to a fraction of its base64 size.
    expect(backup.cels[0].data.length).toBeLessThan(500);
  });

  it("includes every palette, seeded or user-made", async () => {
    await seedDatabase();
    await createPalette("Mine", ["#ffffff"]);

    const backup = await exportBackup();
    expect(backup.palettes).toHaveLength(STARTER_PALETTES.length + 1);
  });

  it("clears spritesheets and re-seeds the starter palettes on delete-all", async () => {
    await seedDatabase();
    await createSpritesheet({ name: "Sheet" });

    await clearAllData();

    expect(await db.spritesheets.count()).toBe(0);
    expect(await db.palettes.count()).toBe(STARTER_PALETTES.length);
  });

  it("round-trips a spritesheet through export and import", async () => {
    await seedDatabase();
    const sheet = await createSpritesheet({ name: "Sheet" });
    const backup = await exportBackup();
    expect(backup.spritesheets).toHaveLength(1);

    await clearAllData();
    const result = await importBackup(backup, "replace");
    expect(result.ok).toBe(true);

    const restored = await db.spritesheets.get(sheet.id);
    expect(restored?.name).toBe("Sheet");
  });

  it("keeps local sprites and reports skips in merge mode", async () => {
    const sprite = await seedLibrary();
    const backup = await exportBackup();

    await db.sprites.update(sprite.id, { name: "Renamed locally" });
    const result = await importBackup(backup, "merge");

    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.value.skipped).toBe(1);
    expect((await db.sprites.get(sprite.id))?.name).toBe("Renamed locally");
  });

  it("adds sprites that are not present locally in merge mode", async () => {
    await seedLibrary();
    const backup = await exportBackup();
    await clearAllData();

    const result = await importBackup(backup, "merge");
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.value.skipped).toBe(0);
    expect(await db.sprites.count()).toBe(1);
  });

  it("rejects a foreign file without touching the database", async () => {
    await seedLibrary();
    const before = await db.sprites.count();

    const result = await importBackup({ hello: "world" }, "replace");

    expect(result).toMatchObject({ ok: false });
    expect(await db.sprites.count()).toBe(before);
  });

  it("refuses a backup from a newer format version", () => {
    const result = validateBackup({
      format: "sprite-editor-backup",
      version: 999,
      sprites: [],
      layers: [],
      cels: [],
      palettes: [],
    });

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/newer version/);
  });

  it("reports counts for the import dialog", async () => {
    await seedLibrary();
    await createSpritesheet({ name: "Sheet" });
    const backup = await exportBackup();

    expect(backup.counts).toMatchObject({ sprites: 1, layers: 1, cels: 1, spritesheets: 1 });
  });
});
