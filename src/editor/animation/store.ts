import { create } from "zustand";
import { ONION_DEFAULT, type OnionDirection } from "@/constants/animation";

export interface OnionConfig {
  enabled: boolean;
  direction: OnionDirection;
  opacity: number;
}

export interface AnimationState {
  onion: OnionConfig;
  /** Mirrors the preview player so the renderer can skip onion skin during playback. */
  isPlaying: boolean;

  setOnion: (patch: Partial<OnionConfig>) => void;
  setPlaying: (isPlaying: boolean) => void;
}

/** Onion-skin settings and whether the preview is playing. */
export const useAnimationStore = create<AnimationState>()((set) => ({
  onion: { ...ONION_DEFAULT },
  isPlaying: false,

  setOnion: (patch) => set(({ onion }) => ({ onion: { ...onion, ...patch } })),
  setPlaying: (isPlaying) => set({ isPlaying }),
}));
