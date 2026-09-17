import { useEffect, type RefObject } from "react";
import { compositeFrame, type CompositeOptions } from "@/editor/composite";
import type { SpriteDocument } from "@/editor/document";

/**
 * Paints a frame (optionally one layer) into a canvas and repaints on change, throttled to
 * one animation frame. Imperative on purpose: thumbnails must not re-render React.
 */
export function useThumbnailCanvas(
  ref: RefObject<HTMLCanvasElement | null>,
  doc: SpriteDocument,
  frameId: string | null,
  options: CompositeOptions = {},
): void {
  const { onlyLayerId, includeHidden } = options;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !frameId) return;

    let queued = false;

    const paint = () => {
      queued = false;
      const source = compositeFrame(doc, frameId, undefined, { onlyLayerId, includeHidden });
      const scale = Math.min(canvas.width / doc.width, canvas.height / doc.height);
      const width = doc.width * scale;
      const height = doc.height * scale;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        source,
        Math.round((canvas.width - width) / 2),
        Math.round((canvas.height - height) / 2),
        width,
        height,
      );
    };

    paint();

    const offPixels = doc.events.on("pixels", (event) => {
      if (event.frameId !== frameId || queued) return;
      if (onlyLayerId && event.layerId !== onlyLayerId) return;
      queued = true;
      requestAnimationFrame(paint);
    });
    // Visibility and opacity changes are meta events, not pixel events.
    const offMeta = doc.events.on("meta", () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    });

    return () => {
      offPixels();
      offMeta();
    };
  }, [ref, doc, frameId, onlyLayerId, includeHidden]);
}
