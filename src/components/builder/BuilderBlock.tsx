import { useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUILDER_ZOOM } from "@/constants/builder";
import type { SpritesheetBlockRecord } from "@/db/schema";
import type { SpriteDocument } from "@/editor/document";
import { renderSpriteStrip } from "@/export/spriteStrip";
import { cn } from "@/lib/utils";

export interface BuilderBlockProps {
  block: SpritesheetBlockRecord;
  doc: SpriteDocument | undefined;
  onRemove: () => void;
}

export function BuilderBlock({ block, doc, onRemove }: BuilderBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    data: { type: "block", blockId: block.id },
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const frameCount = doc?.frames.length ?? 1;
  const width = (doc?.width ?? 16) * frameCount;
  const height = doc?.height ?? 16;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    const strip = renderSpriteStrip(doc);
    canvas.width = strip.width;
    canvas.height = strip.height;
    canvas.getContext("2d")?.drawImage(strip, 0, 0);
  }, [doc]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Translate.toString(transform),
        left: block.x * BUILDER_ZOOM,
        top: block.y * BUILDER_ZOOM,
        width: width * BUILDER_ZOOM,
        height: height * BUILDER_ZOOM,
      }}
      className={cn(
        "group absolute touch-none rounded-sm bg-checker-a ring-1 ring-border",
        isDragging && "z-10 opacity-70",
      )}
    >
      {doc ? (
        <canvas ref={canvasRef} className="pixelated block h-full w-full" />
      ) : (
        <div className="h-full w-full animate-pulse bg-muted" />
      )}

      {/* Stays hidden until hover or keyboard focus, but stays in the a11y tree either way
          (unlike display:none, which drops it from the accessibility tree entirely). */}
      <Button
        size="icon-xs"
        variant="destructive"
        className="pointer-events-none absolute -top-2 -right-2 group-focus-within:pointer-events-auto group-hover:pointer-events-auto"
        revealOnHover
        aria-label={`Remove ${doc?.name ?? "sprite"}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onRemove}
      >
        <X />
      </Button>

      <span className="pointer-events-none absolute -bottom-5 left-0 truncate text-[10px] text-muted-foreground">
        {doc?.name ?? "Missing sprite"}
      </span>
    </div>
  );
}
