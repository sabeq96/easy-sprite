import { create } from "zustand";

export interface FramesState {
  /** The frame tools draw on; null until the guard picks one for the open sprite. */
  activeFrameId: string | null;

  setActiveFrame: (frameId: string) => void;
}

/** Which frame is active, as chosen in the frames bar. */
export const useFramesStore = create<FramesState>()((set) => ({
  activeFrameId: null,

  setActiveFrame: (activeFrameId) => set({ activeFrameId }),
}));
