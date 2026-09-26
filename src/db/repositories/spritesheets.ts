import { db } from "@/db/db";
import { NotFoundError, withQuotaGuard } from "@/db/errors";
import type { SpritesheetRecord } from "@/db/schema";
import { DEFAULT_TILE_SIZE } from "@/constants/canvas";
import { DEFAULT_ITEM_NAME } from "@/constants/names";
import { nameOrDefault } from "@/lib/format";
import { createId } from "@/lib/id";

export interface CreateSpritesheetOptions {
  name?: string;
  tileSize?: number;
  tags?: string[];
}

export async function createSpritesheet(
  options: CreateSpritesheetOptions = {},
): Promise<SpritesheetRecord> {
  const now = Date.now();
  const spritesheet: SpritesheetRecord = {
    id: createId(),
    name: nameOrDefault(options.name, DEFAULT_ITEM_NAME),
    blocks: [],
    tileSize: options.tileSize ?? DEFAULT_TILE_SIZE,
    tags: options.tags ?? [],
    createdAt: now,
    updatedAt: now,
    thumbnail: null,
  };

  await withQuotaGuard(() => db.spritesheets.add(spritesheet));

  return spritesheet;
}

/** Newest first; with a `tag`, only the spritesheets carrying it. */
export function listSpritesheets(tag: string | null = null): Promise<SpritesheetRecord[]> {
  if (tag) return db.spritesheets.where("tags").equals(tag).reverse().sortBy("updatedAt");
  return db.spritesheets.orderBy("updatedAt").reverse().toArray();
}

/** For callers where absence is an expected state (e.g. a live query on a route param). */
export function findSpritesheet(id: string): Promise<SpritesheetRecord | undefined> {
  return db.spritesheets.get(id);
}

export async function getSpritesheet(id: string): Promise<SpritesheetRecord> {
  const spritesheet = await findSpritesheet(id);
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
