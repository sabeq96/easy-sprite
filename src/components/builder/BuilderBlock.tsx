import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUILDER_ZOOM } from "@/constants/builder";
import type { SpritesheetBlockRecord } from "@/db/schema";
import type { SpriteDocument } from "@/editor/document";
import { renderSpriteStrip } from "@/export/spriteStrip";
import { useDragSource } from "@/hooks/useDnd";
import { cn } from "@/lib/utils";

export interface BuilderBlockProps {
  block: SpritesheetBlockRecord;
  doc: SpriteDocument | undefined;
  onRemove: () => void;
}

/** A block's footprint on the sheet, in screen pixels. */
function blockSize(doc: SpriteDocument | undefined) {
  const frameCount = doc?.frames.length ?? 1;
  return {
    width: (doc?.width ?? 16) * frameCount * BUILDER_ZOOM,
    height: (doc?.height ?? 16) * BUILDER_ZOOM,
  };
}

function SpriteStrip({ doc }: { doc: SpriteDocument | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    const strip = renderSpriteStrip(doc);
    canvas.width = strip.width;
    canvas.height = strip.height;
    canvas.getContext("2d")?.drawImage(strip, 0, 0);
  }, [doc]);

  if (!doc) return <div className="h-full w-full animate-pulse bg-muted" />;
  return <canvas ref={canvasRef} className="pixelated block h-full w-full" />;
}

export function BuilderBlock({ block, doc, onRemove }: BuilderBlockProps) {
  const { dragProps, dragClass } = useDragSource(block.id, { type: "block", blockId: block.id });

  return (
    <div
      {...dragProps}
      style={{ left: block.x * BUILDER_ZOOM, top: block.y * BUILDER_ZOOM, ...blockSize(doc) }}
      className={cn("group absolute rounded-sm bg-checker-a ring-1 ring-border", dragClass)}
    >
      <SpriteStrip doc={doc} />

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

/** The block's own visual, for the board's drag overlay — at its true size on the sheet. */
export function BuilderBlockPreview({ doc }: { doc: SpriteDocument | undefined }) {
  return (
    <div className="rounded-sm bg-checker-a" style={blockSize(doc)}>
      <SpriteStrip doc={doc} />
    </div>
  );
}
