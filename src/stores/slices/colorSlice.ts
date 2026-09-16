import { RECENT_COLORS_MAX } from "@/constants/palettes";
import { BLACK, rgbaToHex, TRANSPARENT, type RGBA } from "@/lib/color";
import type { SliceCreator } from "@/stores/slices/types";

export interface ColorSlice {
  primaryColor: RGBA;
  secondaryColor: RGBA;
  recentColors: string[];
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
  recentColors: [],
  activePaletteId: null,

  setPrimaryColor: (primaryColor) =>
    set(({ recentColors }) => {
      if (primaryColor.a === 0) return { primaryColor, recentColors };
      const hex = rgbaToHex(primaryColor, true);
      return {
        primaryColor,
        recentColors: [hex, ...recentColors.filter((entry) => entry !== hex)].slice(
          0,
          RECENT_COLORS_MAX,
        ),
      };
    }),

  setSecondaryColor: (secondaryColor) => set({ secondaryColor }),

  swapColors: () =>
    set(({ primaryColor, secondaryColor }) => ({
      primaryColor: secondaryColor,
      secondaryColor: primaryColor,
    })),

  resetColors: () => set({ primaryColor: { ...BLACK }, secondaryColor: { ...TRANSPARENT } }),
  setActivePalette: (activePaletteId) => set({ activePaletteId }),
});
