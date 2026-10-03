import { useLiveQuery } from "dexie-react-hooks";
import { listPalettes } from "@/db/repositories/palettes";
import type { PaletteRecord } from "@/db/schema";

const NO_PALETTES: PaletteRecord[] = [];

/** Every stored palette, live; empty until the first read lands. */
export function usePaletteList(): PaletteRecord[] {
  return useLiveQuery(() => listPalettes(), [], NO_PALETTES);
}
