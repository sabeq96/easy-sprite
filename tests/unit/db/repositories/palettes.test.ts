import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import { createPalette, getPalette, updatePalette } from "@/db/repositories/palettes";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("palette repository", () => {
  it("keeps each color once when a palette is created", async () => {
    const palette = await createPalette("Imported", ["#ff0000", "#00ff00", "#ff0000"]);
    expect((await getPalette(palette.id))?.colors).toEqual(["#ff0000", "#00ff00"]);
  });

  it("keeps each color once when a palette's colors are replaced", async () => {
    const palette = await createPalette("Mine", ["#ff0000"]);
    await updatePalette(palette.id, { colors: ["#0000ff", "#ff0000", "#0000ff"] });
    expect((await getPalette(palette.id))?.colors).toEqual(["#0000ff", "#ff0000"]);
  });

  it("leaves the colors alone when only the name changes", async () => {
    const palette = await createPalette("Mine", ["#ff0000"]);
    await updatePalette(palette.id, { name: "Renamed" });
    expect(await getPalette(palette.id)).toMatchObject({ name: "Renamed", colors: ["#ff0000"] });
  });
});
