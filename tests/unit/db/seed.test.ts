import { beforeEach, describe, expect, it } from "vitest";
import { STARTER_PALETTES } from "@/constants/palettes";
import { db } from "@/db/db";
import { createPalette, getPalette, listPalettes, removePalette, updatePalette } from "@/db/repositories/palettes";
import { seedDatabase } from "@/db/seed";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("seeding", () => {
  it("inserts the starter palettes on a fresh database", async () => {
    await seedDatabase();
    expect(await db.palettes.count()).toBe(STARTER_PALETTES.length);
  });

  it("is idempotent across boots", async () => {
    await seedDatabase();
    await seedDatabase();
    expect(await db.palettes.count()).toBe(STARTER_PALETTES.length);
  });

  it("never clobbers a user palette", async () => {
    const mine = await createPalette("Mine", ["#ffffff"]);
    await seedDatabase();

    const palettes = await listPalettes();
    expect(palettes.find((palette) => palette.id === mine.id)?.colors).toEqual(["#ffffff"]);
    expect(palettes).toHaveLength(STARTER_PALETTES.length + 1);
  });

  it("keeps an edited starter palette across boots", async () => {
    await seedDatabase();
    await updatePalette(STARTER_PALETTES[0].id, { name: "Mine now", colors: ["#123456"] });
    await seedDatabase();

    const palette = await getPalette(STARTER_PALETTES[0].id);
    expect(palette?.name).toBe("Mine now");
    expect(palette?.colors).toEqual(["#123456"]);
  });

  it("does not resurrect a deleted starter palette", async () => {
    await seedDatabase();
    await removePalette(STARTER_PALETTES[0].id);
    await seedDatabase();

    expect(await getPalette(STARTER_PALETTES[0].id)).toBeUndefined();
    expect(await db.palettes.count()).toBe(STARTER_PALETTES.length - 1);
  });

  it("allows deleting a starter palette, same as any other", async () => {
    await seedDatabase();
    await expect(removePalette(STARTER_PALETTES[0].id)).resolves.toBeUndefined();
  });
});
