import { create } from "zustand";
import { BLACK, TRANSPARENT, type RGBA } from "@/lib/color";

export interface PaletteState {
  primaryColor: RGBA;
  secondaryColor: RGBA;
  activePaletteId: string | null;

  setPrimaryColor: (color: RGBA) => void;
  setSecondaryColor: (color: RGBA) => void;
  swapColors: () => void;
  resetColors: () => void;
  setActivePalette: (paletteId: string | null) => void;
}

/** The colors tools paint with, and which stored palette the panel shows. */
export const usePaletteStore = create<PaletteState>()((set) => ({
  primaryColor: { ...BLACK },
  secondaryColor: { ...TRANSPARENT },
  activePaletteId: null,

  setPrimaryColor: (primaryColor) => set({ primaryColor }),
  setSecondaryColor: (secondaryColor) => set({ secondaryColor }),

  swapColors: () =>
    set(({ primaryColor, secondaryColor }) => ({
      primaryColor: secondaryColor,
      secondaryColor: primaryColor,
    })),

  resetColors: () => set({ primaryColor: { ...BLACK }, secondaryColor: { ...TRANSPARENT } }),
  setActivePalette: (activePaletteId) => set({ activePaletteId }),
}));
