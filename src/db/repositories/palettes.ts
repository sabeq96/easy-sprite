import { DEFAULT_PALETTE_NAME } from "@/constants/names";
import { db } from "@/db/db";
import { withQuotaGuard } from "@/db/errors";
import type { PaletteRecord } from "@/db/schema";
import { nameOrDefault } from "@/lib/format";
import { createId } from "@/lib/id";

export function listPalettes(): Promise<PaletteRecord[]> {
  return db.palettes.orderBy("name").toArray();
}

/** Palettes can be deleted from under a stale id, so absence is an expected result here. */
export function findPalette(id: string): Promise<PaletteRecord | undefined> {
  return db.palettes.get(id);
}

/**
 * A palette holds each color once. Imported .gpl/.hex files can repeat one, and a repeated color
 * would be two swatches with one identity — the sortable grid keys and tracks swatches by color.
 */
function uniqueColors(colors: string[]): string[] {
  return [...new Set(colors)];
}

export async function createPalette(name: string, colors: string[]): Promise<PaletteRecord> {
  const now = Date.now();
  const palette: PaletteRecord = {
    id: createId(),
    name: nameOrDefault(name, DEFAULT_PALETTE_NAME),
    colors: uniqueColors(colors),
    createdAt: now,
    updatedAt: now,
  };
  await withQuotaGuard(() => db.palettes.add(palette));
  return palette;
}

export function updatePalette(
  id: string,
  patch: Partial<Pick<PaletteRecord, "name" | "colors">>,
): Promise<number> {
  const colors = patch.colors && uniqueColors(patch.colors);
  return withQuotaGuard(() =>
    db.palettes.update(id, { ...patch, ...(colors && { colors }), updatedAt: Date.now() }),
  );
}

export function removePalette(id: string): Promise<void> {
  return db.palettes.delete(id);
}
