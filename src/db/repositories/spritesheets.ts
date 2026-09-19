import { db } from "@/db/db";
import { NotFoundError, withQuotaGuard } from "@/db/errors";
import type { SpritesheetRecord } from "@/db/schema";
import { createId } from "@/lib/id";

export interface CreateSpritesheetOptions {
  name?: string;
}

export async function createSpritesheet(
  options: CreateSpritesheetOptions = {},
): Promise<SpritesheetRecord> {
  const now = Date.now();
  const spritesheet: SpritesheetRecord = {
    id: createId(),
    name: options.name?.trim() || "Untitled",
    blocks: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
    thumbnail: null,
  };

  await withQuotaGuard(() => db.spritesheets.add(spritesheet));

  return spritesheet;
}

export function listSpritesheets(): Promise<SpritesheetRecord[]> {
  return db.spritesheets.orderBy("updatedAt").reverse().toArray();
}

export async function getSpritesheet(id: string): Promise<SpritesheetRecord> {
  const spritesheet = await db.spritesheets.get(id);
  if (!spritesheet) throw new NotFoundError("Spritesheet", id);
  return spritesheet;
}

export function updateSpritesheet(
  id: string,
  patch: Partial<Omit<SpritesheetRecord, "id" | "createdAt">>,
): Promise<number> {
  return withQuotaGuard(() => db.spritesheets.update(id, { ...patch, updatedAt: Date.now() }));
}

export function removeSpritesheet(id: string): Promise<void> {
  return db.spritesheets.delete(id);
}
