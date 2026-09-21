import { db } from "@/db/db";
import type { PaletteRecord } from "@/db/schema";
import { createId } from "@/lib/id";

export function listPalettes(): Promise<PaletteRecord[]> {
  return db.palettes.orderBy("name").toArray();
}

export function getPalette(id: string): Promise<PaletteRecord | undefined> {
  return db.palettes.get(id);
}

export async function createPalette(name: string, colors: string[]): Promise<PaletteRecord> {
  const now = Date.now();
  const palette: PaletteRecord = {
    id: createId(),
    name: name.trim() || "New palette",
    colors,
    createdAt: now,
    updatedAt: now,
  };
  await db.palettes.add(palette);
  return palette;
}

export function updatePalette(
  id: string,
  patch: Partial<Pick<PaletteRecord, "name" | "colors">>,
): Promise<number> {
  return db.palettes.update(id, { ...patch, updatedAt: Date.now() });
}

export function removePalette(id: string): Promise<void> {
  return db.palettes.delete(id);
}
