import { create } from "zustand";
import type { RGBA } from "@/lib/color";

export interface CursorState {
  /** Sprite-space position, or null when the pointer is off-canvas. */
  position: { x: number; y: number } | null;
  color: RGBA | null;
  setCursor: (position: { x: number; y: number } | null, color: RGBA | null) => void;
}

/**
 * The canvas module's store: the pointer's sprite position and the colour under it. It updates
 * on every pointer move; only the status bar reads it, and no command does.
 */
export const useCursorStore = create<CursorState>()((set) => ({
  position: null,
  color: null,
  setCursor: (position, color) => set({ position, color }),
}));
