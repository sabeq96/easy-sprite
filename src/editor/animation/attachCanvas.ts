import { drawOnion } from "@/core/painters/onion";
import type { CanvasRenderer } from "@/core/renderer";
import { useAnimationStore } from "./store";

/** Registers the onion painter, and repaints its channel whenever the onion settings change. */
export function attachOnion(renderer: CanvasRenderer): () => void {
  const scratch = new OffscreenCanvas(1, 1);
  const removePainter = renderer.addPainter({
    channel: "onion",
    // Onion skin is meaningless during playback and costs a composite per ghost frame.
    paint: (p) => {
      const { onion } = useAnimationStore.getState();
      if (onion.enabled && !p.isPlaying) drawOnion(p, onion, scratch);
    },
  });

  // The painter reads the store at paint time.
  const unsubscribe = useAnimationStore.subscribe((state, previous) => {
    if (state.onion !== previous.onion) renderer.invalidate("onion");
  });

  return () => {
    unsubscribe();
    removePainter();
  };
}
