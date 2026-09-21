import { STARTER_PALETTES } from "@/constants/palettes";
import { SETTING_KEYS } from "@/constants/settings";
import { db } from "@/db/db";
import { readSetting, writeSetting } from "@/db/repositories/settings";
import type { PaletteRecord } from "@/db/schema";

async function seedPalettes(): Promise<void> {
  const now = Date.now();
  const rows: PaletteRecord[] = STARTER_PALETTES.map((palette) => ({
    id: palette.id,
    name: palette.name,
    colors: [...palette.colors],
    createdAt: now,
    updatedAt: now,
  }));
  await db.palettes.bulkPut(rows);
}

/**
 * Starter content for a fresh database. Add an entry here (an example sprite, a sample
 * spritesheet) and it reaches new *and* existing users exactly once — the marker records seeder
 * names, not a single "seeded" flag.
 *
 * A seeder must be idempotent on its own ids: the marker is the guard, but a half-finished
 * previous run can leave rows behind.
 */
const SEEDERS: { name: string; run: () => Promise<void> }[] = [
  { name: "palettes", run: seedPalettes },
];

/**
 * Runs every seeder that has not run in this browser. Deliberately *not* "insert whatever is
 * missing": starter content the user deleted must stay deleted, so the marker — not the table's
 * contents — decides.
 */
export async function seedDatabase(): Promise<void> {
  const done = await readSetting<string[]>(SETTING_KEYS.seeded, []);
  const pending = SEEDERS.filter((seeder) => !done.includes(seeder.name));
  if (pending.length === 0) return;

  for (const seeder of pending) await seeder.run();
  await writeSetting(SETTING_KEYS.seeded, [...done, ...pending.map((seeder) => seeder.name)]);
}
