import { BUILT_IN_PALETTES } from "@/constants/palettes";
import { db } from "@/db/db";
import type { PaletteRecord } from "@/db/schema";

/**
 * Idempotent: runs on every boot so new built-ins reach existing users. Built-ins own the
 * reserved `builtin-` id prefix, so this can never clobber a user palette.
 */
export async function seedDatabase(): Promise<void> {
  const now = Date.now();
  const rows: PaletteRecord[] = BUILT_IN_PALETTES.map((palette) => ({
    ...palette,
    builtIn: true,
    createdAt: now,
    updatedAt: now,
  }));
  await db.palettes.bulkPut(rows);
}
