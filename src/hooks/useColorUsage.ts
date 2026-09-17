import { useEffect, useState } from "react";
import { collectColorUsage, type ColorUsage } from "@/editor/colorUsage";
import type { SpriteDocument } from "@/editor/document";

const RECOMPUTE_DELAY_MS = 400;

/**
 * Recomputes 400 ms after the last pixel change, so a full-document scan never runs
 * mid-stroke on a large sprite.
 */
export function useColorUsage(doc: SpriteDocument): ColorUsage[] {
  const [usage, setUsage] = useState<ColorUsage[]>([]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setUsage(collectColorUsage(doc)), RECOMPUTE_DELAY_MS);
    };

    schedule();
    const offPixels = doc.events.on("pixels", schedule);
    const offStructure = doc.events.on("structure", schedule);

    return () => {
      clearTimeout(timer);
      offPixels();
      offStructure();
    };
  }, [doc]);

  return usage;
}
