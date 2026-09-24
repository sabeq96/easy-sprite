import { BuilderBlock } from "@/components/builder/BuilderBlock";
import { gutterDropId, type BuilderRowView } from "@/components/builder/useBuilderDnd";

import type { SpriteDocument } from "@/editor/document";
import type { BlockSizes } from "@/lib/sheetLayout";
import { useDropZone } from "@/hooks/useDnd";
import { cn } from "@/lib/utils";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";

export interface BuilderRowProps {
  row: BuilderRowView;
  sizes: BlockSizes;
  docs: Map<string, SpriteDocument>;
  ghostId: string | null;
  /** The always-available row below the sheet: it fills the rest of the panel. */
  isTrailing: boolean;
  /** Only the trailing row of an empty sheet says anything — it is the whole empty state. */
  isSheetEmpty: boolean;
  onRemoveBlock: (blockId: string) => void;
}

export function BuilderRow({
  row,
  sizes,
  docs,
  ghostId,
  isTrailing,
  isSheetEmpty,
  onRemoveBlock,
}: BuilderRowProps) {
  const zoom = useBuilderViewStore((state) => state.zoom);
  // Low priority: a block under the pointer wins the collision over the row behind it, so the row
  // itself is only the target along its empty stretch — where a drop means "append". `owns` keeps
  // it ringed while the pointer is on one of its own blocks.
  const { ref, dropClass } = useDropZone({
    id: row.key,
    priority: "low",
    collision: "pointer",
    owns: (overId) => row.blocks.some((block) => block.id === overId),
  });

  return (
    <div
      ref={ref}
      data-testid={isTrailing ? "builder-trailing-row" : "builder-row"}
      // The trailing row has its own min-height (it is the empty area); every other row keeps its
      // height for the length of a drag — see BuilderRowView.heldHeight.
      style={!isTrailing && row.heldHeight ? { minHeight: row.heldHeight * zoom } : undefined}
      className={cn(
        // items-start: a short block sits at its row's top edge, exactly where packSheet puts it.
        // No gap, padding or rounding on a real row — each would be a gap the export doesn't have.
        "relative flex items-start",
        isTrailing && "min-h-24 flex-1 rounded-lg border border-dashed border-border",
        dropClass,
      )}
    >
      {row.blocks.map((block, index) => (
        <BuilderBlock
          key={block.id}
          block={block}
          index={index}
          rowKey={row.key}
          size={sizes.get(block.spriteId)}
          doc={docs.get(block.spriteId)}
          isGhost={block.id === ghostId}
          onRemove={() => onRemoveBlock(block.id)}
        />
      ))}

      {isTrailing && isSheetEmpty && row.blocks.length === 0 && (
        <p className="m-auto self-center text-xs text-muted-foreground">
          Drag sprites here to build the sheet.
        </p>
      )}
    </div>
  );
}

/**
 * The boundary above row `index`: dropping on it opens a new row there.
 *
 * h-0 — a gutter must take no layout height, or the rows it separates would show a gap the
 * exported sheet does not have. Its hit area is a strip straddling the boundary, over the edges of
 * the rows either side at the highest collision priority: right at a boundary you mean "new row",
 * not "join the row above". pointer-events-none, because collisions are measured from rects, not
 * hit-tested — so the strip wins a drag without stealing the press that starts one on a block.
 */
export function RowGutter({
  index,
  reachAbove,
  reachBelow,
}: {
  index: number;
  /** Screen px the strip reaches into the row above it, and the row below. */
  reachAbove: number;
  reachBelow: number;
}) {
  const { ref, isOver } = useDropZone({
    id: gutterDropId(index),
    priority: "highest",
    collision: "pointer",
  });

  return (
    <div className="pointer-events-none relative z-10 h-0">
      <div
        ref={ref}
        data-testid={`builder-gutter-${index}`}
        className="absolute inset-x-0"
        style={{ top: -reachAbove, height: reachAbove + reachBelow }}
      />
      {isOver && (
        <div aria-hidden className="absolute inset-x-0 -top-px h-0.5 rounded-full bg-primary" />
      )}
    </div>
  );
}
