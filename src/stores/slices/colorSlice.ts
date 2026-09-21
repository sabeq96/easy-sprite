import { BLACK, TRANSPARENT, type RGBA } from "@/lib/color";
import type { SliceCreator } from "@/stores/slices/types";

export interface ColorSlice {
  primaryColor: RGBA;
  secondaryColor: RGBA;
  activePaletteId: string | null;

  setPrimaryColor: (color: RGBA) => void;
  setSecondaryColor: (color: RGBA) => void;
  swapColors: () => void;
  resetColors: () => void;
  setActivePalette: (paletteId: string | null) => void;
}

export const createColorSlice: SliceCreator<ColorSlice> = (set) => ({
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
});
