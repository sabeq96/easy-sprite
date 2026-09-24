import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { DragData } from "@/components/builder/useBuilderDnd";
import { Button } from "@/components/ui/button";
import { BUILDER_BLOCK_CHROME_MIN_PX, BUILDER_FALLBACK_BLOCK_PX } from "@/constants/builder";
import type { SpritesheetBlockRecord } from "@/db/schema";
import type { SpriteDocument } from "@/editor/document";
import type { BlockSize } from "@/lib/sheetLayout";
import { renderSpriteStrip } from "@/export/spriteStrip";
import { useSortableItem } from "@/hooks/useDnd";
import { cn } from "@/lib/utils";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";

export interface BuilderBlockProps {
  block: SpritesheetBlockRecord;
  /** Position within its row, and the row's key — the block's sortable index and group. */
  index: number;
  rowKey: string;
  size: BlockSize | undefined;
  doc: SpriteDocument | undefined;
  /** The stand-in for a sprite still being dragged in from the dock. */
  isGhost: boolean;
  onRemove: () => void;
}

/** A block's footprint on screen: sprite px times the current zoom. */
function useScreenSize(size: BlockSize | undefined) {
  const zoom = useBuilderViewStore((state) => state.zoom);
  return {
    width: (size?.w ?? BUILDER_FALLBACK_BLOCK_PX) * zoom,
    height: (size?.h ?? BUILDER_FALLBACK_BLOCK_PX) * zoom,
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

export function BuilderBlock({ block, index, rowKey, size, doc, isGhost, onRemove }: BuilderBlockProps) {
  const screenSize = useScreenSize(size);
  const hasRoom = Math.min(screenSize.width, screenSize.height) >= BUILDER_BLOCK_CHROME_MIN_PX;
  const { dragProps, dragClass } = useSortableItem(block.id, {
    index,
    group: rowKey,
    collision: "pointer",
    data: { type: "block", blockId: block.id } satisfies DragData,
  });

  return (
    <div
      {...dragProps}
      data-block-id={block.id}
      aria-hidden={isGhost || undefined}
      aria-label={isGhost ? undefined : (doc?.name ?? "Missing sprite")}
      title={isGhost ? undefined : doc?.name}
      style={screenSize}
      className={cn(
        // shrink-0 keeps a long row overflowing (and scrolling) instead of squashing its blocks,
        // which would put the screen out of step with the export. ring-inset, and no rounding: a
        // ring straddling the edge, or a rounded corner, would read as a gap between two blocks
        // that are in fact flush.
        "group relative shrink-0 bg-checker-a ring-1 ring-border ring-inset",
        isGhost && "opacity-60 ring-2 ring-primary",
        dragClass,
      )}
    >
      <SpriteStrip doc={doc} />

      {!isGhost && (
        <>
          {/* The name used to hang below the block; in a gapless sheet that would land on the next
              row, so it is a hover caption inside the block instead — when the block has room. */}
          {hasRoom && (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 hidden truncate bg-background/70 px-0.5 text-[10px] text-muted-foreground group-hover:block">
              {doc?.name}
            </span>
          )}

          {/* Stays hidden until hover or keyboard focus, but stays in the a11y tree either way
              (unlike display:none, which drops it from the accessibility tree entirely). */}
          <Button
            size="icon-xs"
            variant="destructive"
            className={cn(
              "pointer-events-none absolute top-0.5 right-0.5 z-10",
              hasRoom
                ? "group-focus-within:pointer-events-auto group-hover:pointer-events-auto"
                : // Too small to carry it: never shown on hover (it would cover the block, which is
                  // the drag handle), only while the button itself has keyboard focus.
                  "opacity-0 focus-visible:opacity-100",
            )}
            revealOnHover={hasRoom}
            aria-label={`Remove ${doc?.name ?? "sprite"}`}
            // Pressing the ✕ and wobbling must remove, not start dragging the block.
            data-no-drag
            onClick={onRemove}
          >
            <X />
          </Button>
        </>
      )}
    </div>
  );
}

/** The block's own visual, for the board's drag overlay — at its true size on the sheet. */
export function BuilderBlockPreview({
  size,
  doc,
}: {
  size: BlockSize | undefined;
  doc: SpriteDocument | undefined;
}) {
  return (
    <div className="bg-checker-a" style={useScreenSize(size)}>
      <SpriteStrip doc={doc} />
    </div>
  );
}
