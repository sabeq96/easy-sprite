import { useRef } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { LAYER_THUMB_PX } from "@/constants/canvas";
import { useThumbnailCanvas } from "@/hooks/useThumbnailCanvas";

export interface LayerThumbnailProps {
  layerId: string;
  frameId: string | null;
}

export function LayerThumbnail({ layerId, frameId }: LayerThumbnailProps) {
  const { doc } = useDocumentSession();
  const ref = useRef<HTMLCanvasElement>(null);

  // includeHidden: the row should still show what a hidden layer contains.
  useThumbnailCanvas(ref, doc, frameId, { onlyLayerId: layerId, includeHidden: true });

  return (
    <canvas
      ref={ref}
      width={LAYER_THUMB_PX}
      height={LAYER_THUMB_PX}
      aria-hidden
      className="size-7 shrink-0 rounded-sm border bg-checker-a"
    />
  );
}
