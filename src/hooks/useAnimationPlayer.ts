import { useCallback, useEffect, useRef, useState } from "react";
import type { SpriteDocument } from "@/editor/document";

export interface AnimationPlayer {
  isPlaying: boolean;
  /** Index the player is on while running. */
  frameIndex: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
}

export interface AnimationPlayerOptions {
  doc: SpriteDocument;
  /** Notified on every advance — the preview and, optionally, the editor follow it. */
  onFrame?: (frameIndex: number) => void;
  startIndex?: number;
}

/**
 * One rAF loop with an accumulator. Not setInterval: at 12 fps a timer drifts against the
 * display refresh and the preview visibly stutters.
 */
export function useAnimationPlayer({
  doc,
  onFrame,
  startIndex = 0,
}: AnimationPlayerOptions): AnimationPlayer {
  const [isPlaying, setPlaying] = useState(false);
  const [frameIndex, setFrameIndex] = useState(startIndex);
  const indexRef = useRef(startIndex);
  // Kept in a ref so a changing callback does not restart the rAF loop mid-playback.
  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!isPlaying || doc.frames.length < 2) return;

    let rafId = 0;
    let previous = performance.now();
    let accumulator = 0;

    const tick = (now: number) => {
      // Read fps every tick so the speed slider takes effect mid-playback.
      const frameDuration = 1000 / Math.max(1, doc.fps);
      accumulator += now - previous;
      previous = now;

      // Clamp so a backgrounded tab does not fast-forward hundreds of frames on return.
      if (accumulator > frameDuration * 4) accumulator = frameDuration;

      while (accumulator >= frameDuration) {
        accumulator -= frameDuration;
        indexRef.current = (indexRef.current + 1) % doc.frames.length;
        setFrameIndex(indexRef.current);
        onFrameRef.current?.(indexRef.current);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, doc]);

  // Identity matters: these are handed to keyboard commands registered in effects.
  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((playing) => !playing), []);

  return { isPlaying, frameIndex, play, pause, toggle };
}
