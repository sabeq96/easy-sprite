import { create } from "zustand";

export interface LayersState {
  /** The layer tools draw on; null until the guard picks one for the open sprite. */
  activeLayerId: string | null;

  setActiveLayer: (layerId: string) => void;
}

/** Which layer is active, as chosen in the Layers panel. */
export const useLayersStore = create<LayersState>()((set) => ({
  activeLayerId: null,

  setActiveLayer: (activeLayerId) => set({ activeLayerId }),
}));
