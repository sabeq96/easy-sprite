import { useRef } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { FRAME_THUMB_PX } from "@/constants/canvas";
import { useThumbnailCanvas } from "@/hooks/useThumbnailCanvas";

export function FrameThumbnail({ frameId }: { frameId: string }) {
  const { doc } = useDocumentSession();
  const ref = useRef<HTMLCanvasElement>(null);

  useThumbnailCanvas(ref, doc, frameId);

  return (
    <canvas
      ref={ref}
      width={FRAME_THUMB_PX}
      height={FRAME_THUMB_PX}
      aria-hidden
      className="size-12 rounded-sm bg-checker-a ring-1 ring-foreground/10"
    />
  );
}
