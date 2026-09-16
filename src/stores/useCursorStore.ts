import { create } from "zustand";
import type { RGBA } from "@/lib/color";

export interface CursorState {
  /** Sprite-space position, or null when the pointer is off-canvas. */
  position: { x: number; y: number } | null;
  color: RGBA | null;
  setCursor: (position: { x: number; y: number } | null, color: RGBA | null) => void;
}

/**
 * Deliberately separate from the editor store: this updates on every pointer move, and only
 * the status bar reads it.
 */
export const useCursorStore = create<CursorState>()((set) => ({
  position: null,
  color: null,
  setCursor: (position, color) => set({ position, color }),
}));
