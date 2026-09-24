import { useEffect, useRef, type RefObject } from "react";
import type { SpriteDocument } from "@/editor/document";
import { renderSpriteStrip } from "@/export/spriteStrip";

/** Paints `doc`'s frames, left to right at 1×, into the returned canvas whenever `doc` changes. */
export function useSpriteStripCanvas(
  doc: SpriteDocument | undefined,
): RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    const strip = renderSpriteStrip(doc);
    canvas.width = strip.width;
    canvas.height = strip.height;
    canvas.getContext("2d")?.drawImage(strip, 0, 0);
  }, [doc]);

  return canvasRef;
}
