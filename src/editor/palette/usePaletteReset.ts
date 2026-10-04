import { useEffect } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { useDefaultsStore } from "@/stores/useDefaultsStore";
import { usePaletteStore } from "./store";

/** The palette panel to the user's default palette whenever a sprite opens. */
export function usePaletteReset(): void {
  const { doc } = useDocumentSession();
  const setActivePalette = usePaletteStore((state) => state.setActivePalette);

  useEffect(() => {
    setActivePalette(useDefaultsStore.getState().defaults.paletteId);
  }, [doc, setActivePalette]);
}
