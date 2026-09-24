import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import type { SpriteRecord } from "@/db/schema";
import { sizesFromRecords, type BlockSizes } from "@/lib/sheetLayout";

const NO_SPRITES: SpriteRecord[] = [];

/** Every sprite's block footprint, keyed by sprite id — available before any document loads. */
export function useSpriteSizes(): BlockSizes {
  const sprites = useLiveQuery(() => db.sprites.toArray(), [], NO_SPRITES);
  return sizesFromRecords(sprites);
}
