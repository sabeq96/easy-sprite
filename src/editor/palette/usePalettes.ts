import { useLiveQuery } from "dexie-react-hooks";
import { listPalettes } from "@/db/repositories/palettes";
import type { PaletteRecord } from "@/db/schema";
import { usePaletteStore } from "./store";

export interface PaletteLibrary {
  palettes: PaletteRecord[];
  active: PaletteRecord | null;
  isLoading: boolean;
}

/**
 * Backed by useLiveQuery, so a palette edit anywhere updates every palette surface with no
 * invalidation code.
 */
export function usePalettes(): PaletteLibrary {
  const palettes = useLiveQuery(() => listPalettes(), []);
  const activePaletteId = usePaletteStore((state) => state.activePaletteId);

  const active =
    palettes?.find((palette) => palette.id === activePaletteId) ?? palettes?.[0] ?? null;

  return { palettes: palettes ?? [], active, isLoading: palettes === undefined };
}
