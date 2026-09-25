import { Fragment, useRef } from "react";
import { BuilderRow, RowGutter } from "@/components/builder/BuilderRow";
import type { BuilderRowView } from "@/hooks/useBuilderDnd";
import { Panel } from "@/components/common/Panel";
import {
  BUILDER_GRID_LINE,
  BUILDER_GRID_MIN_SCALE,
  ROW_GUTTER_MAX_SHARE,
  ROW_GUTTER_REACH_PX,
} from "@/constants/builder";
import type { SpriteDocument } from "@/editor/document";
import type { BlockSizes } from "@/lib/sheetLayout";
import { useBuilderViewport } from "@/hooks/useBuilderViewport";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";

export interface BuilderCanvasProps {
  /** Every row the sheet shows, the trailing empty one last. */
  rows: BuilderRowView[];
  sizes: BlockSizes;
  docs: Map<string, SpriteDocument>;
  ghostId: string | null;
  onRemoveBlock: (blockId: string) => void;
}

/**
 * The sheet: rows of blocks laid out by flexbox, flush in both directions, in a panel that fills
 * the page and scrolls when the sheet outgrows it.
 *
 * The browser lays out what you see here; `packSheet` lays out what gets exported. Both follow the
 * same rules — rows stack with no gap, blocks sit left to right with no gap, a row is as tall as
 * its tallest block — and a browser test holds them together.
 */
export function BuilderCanvas({ rows, sizes, docs, ghostId, onRemoveBlock }: BuilderCanvasProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useBuilderViewport(panelRef);
  const zoom = useBuilderViewStore((state) => state.zoom);
  const isSheetEmpty = rows.every((row) => row.blocks.length === 0);

  // How far the boundary strip above row `index` may reach into a row, given that row's height.
  const reachInto = (index: number) => {
    const row = rows[index];
    if (!row || index === rows.length - 1) return ROW_GUTTER_REACH_PX; // padding or the trailing row
    const heightPx =
      Math.max(row.heldHeight ?? 0, ...row.blocks.map((block) => sizes.get(block.spriteId)?.h ?? 0)) *
      zoom;
    return Math.min(ROW_GUTTER_REACH_PX, heightPx * ROW_GUTTER_MAX_SHARE);
  };

  return (
    <Panel
      variant="secondary"
      render={<div ref={panelRef} />}
      className="min-h-0 flex-1 overflow-auto p-4"
    >
      {/*
        w-max min-w-full: rows stretch to at least the panel's width, so a drop anywhere along a
        row's band joins that row, and grow past it when a row's blocks are wider than the panel.
        min-h-full gives the trailing row's flex-1 something to fill — that is what makes the whole
        empty area below the sheet a live drop target rather than dead space.
      */}
      <div data-testid="builder-canvas" className="relative flex min-h-full w-max min-w-full flex-col">
        {rows.map((row, index) => (
          // Keyed by the row's positional key: a row *is* its position — it holds no state of its
          // own, its blocks are keyed by id, and its key is fixed for the length of a drag.
          <Fragment key={row.key}>
            <RowGutter
              index={index}
              reachAbove={index === 0 ? ROW_GUTTER_REACH_PX : reachInto(index - 1)}
              reachBelow={reachInto(index)}
            />
            <BuilderRow
              row={row}
              sizes={sizes}
              docs={docs}
              ghostId={ghostId}
              isTrailing={index === rows.length - 1}
              isSheetEmpty={isSheetEmpty}
              onRemoveBlock={onRemoveBlock}
            />
          </Fragment>
        ))}

        <BuilderGrid />
      </div>
    </Panel>
  );
}

/**
 * The ruler. Infinite by construction: a repeating gradient over the whole scrollable sheet. Drawn
 * over the blocks, like the pixel editor's grid over its pixels, so a block's edges can be read
 * against it; pointer-events-none keeps it out of every click and drag.
 */
function BuilderGrid() {
  const gridEnabled = useBuilderViewStore((state) => state.gridEnabled);
  const gridCell = useBuilderViewStore((state) => state.gridCell);
  const zoom = useBuilderViewStore((state) => state.zoom);

  const cell = gridCell * zoom;
  if (!gridEnabled || cell < BUILDER_GRID_MIN_SCALE) return null;

  return (
    <div
      aria-hidden
      data-testid="builder-grid"
      className="pointer-events-none absolute inset-0 z-20"
      style={{
        backgroundImage: [
          `repeating-linear-gradient(to right, ${BUILDER_GRID_LINE} 0 1px, transparent 1px ${cell}px)`,
          `repeating-linear-gradient(to bottom, ${BUILDER_GRID_LINE} 0 1px, transparent 1px ${cell}px)`,
        ].join(", "),
      }}
    />
  );
}
