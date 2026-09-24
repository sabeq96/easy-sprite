import { useLiveQuery } from "dexie-react-hooks";
import { findSpritesheet } from "@/db/repositories/spritesheets";
import type { SpritesheetRecord } from "@/db/schema";

export type SpritesheetState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; spritesheet: SpritesheetRecord };

/** One spritesheet, live: every write to it re-renders the caller. */
export function useSpritesheet(id: string): SpritesheetState {
  // `null` marks a finished read that found nothing — `undefined` is useLiveQuery's "not yet".
  const record = useLiveQuery(async () => (await findSpritesheet(id)) ?? null, [id]);
  if (record === undefined) return { status: "loading" };
  if (record === null) return { status: "missing" };
  return { status: "ready", spritesheet: record };
}
