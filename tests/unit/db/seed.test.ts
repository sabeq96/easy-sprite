import { beforeEach, describe, expect, it } from "vitest";
import { BUILT_IN_PALETTES } from "@/constants/palettes";
import { db } from "@/db/db";
import { createPalette, listPalettes, removePalette } from "@/db/repositories/palettes";
import { seedDatabase } from "@/db/seed";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("seeding", () => {
  it("is idempotent across boots", async () => {
    await seedDatabase();
    await seedDatabase();
    expect(await db.palettes.count()).toBe(BUILT_IN_PALETTES.length);
  });

  it("never clobbers a user palette", async () => {
    const mine = await createPalette("Mine", ["#ffffff"]);
    await seedDatabase();

    const palettes = await listPalettes();
    expect(palettes.find((palette) => palette.id === mine.id)?.colors).toEqual(["#ffffff"]);
    expect(palettes).toHaveLength(BUILT_IN_PALETTES.length + 1);
  });

  it("refuses to delete a built-in", async () => {
    await seedDatabase();
    await expect(removePalette(BUILT_IN_PALETTES[0].id)).rejects.toThrow(/Built-in/);
  });
});
