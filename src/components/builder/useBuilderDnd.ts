import { useCallback, type RefObject } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { BUILDER_GRID_SIZE, BUILDER_ZOOM } from "@/constants/builder";
import { updateSpritesheet } from "@/db/repositories/spritesheets";
import type { SpritesheetBlockRecord, SpritesheetRecord } from "@/db/schema";
import type { SpriteDocument } from "@/editor/document";
import { blockRect } from "@/export/spritesheetBuilderLayout";
import type { SaveStatusTracker } from "@/hooks/useSaveStatus";
import { createId } from "@/lib/id";
import { rectsIntersect, type Rect } from "@/lib/rect";
import { saveSpritesheetThumbnail } from "@/services/thumbnails";

/**
 * A palette drag carries the sprite's dimensions rather than relying on the document cache: the
 * cache only holds sprites already placed on this sheet, so a sprite being dropped for the first
 * time has no document yet. The palette has the record in hand, so it passes the size along.
 */
export type DragData =
  | {
      type: "palette";
      spriteId: string;
      name: string;
      width: number;
      height: number;
      frameCount: number;
      /** Carried along so the drag preview can be the dock tile itself, thumbnail and all. */
      thumbnail: Blob | null;
    }
  | { type: "block"; blockId: string };

function snap(value: number): number {
  return Math.max(0, Math.round(value / BUILDER_GRID_SIZE) * BUILDER_GRID_SIZE);
}

/**
 * Where the cursor was released, in canvas-local sprite pixels.
 *
 * Taken from the pointer rather than the dragged node's rect: a palette tile is a fixed 80px
 * thumbnail docked at the bottom of the page, so its rect says nothing about where on the sheet
 * a sprite of a different size should land. The cursor does.
 */
function dropPoint(canvas: HTMLElement, event: DragEndEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const activator = event.activatorEvent as PointerEvent;
  return {
    x: snap((activator.clientX + event.delta.x - rect.left) / BUILDER_ZOOM),
    y: snap((activator.clientY + event.delta.y - rect.top) / BUILDER_ZOOM),
  };
}

/** Where an already-placed block lands after a drag, or null if it can't be resolved yet. */
function movedPlacement(
  blocks: SpritesheetBlockRecord[],
  docs: Map<string, SpriteDocument>,
  blockId: string,
  event: DragEndEvent,
): { x: number; y: number; w: number; h: number } | null {
  const block = blocks.find((entry) => entry.id === blockId);
  const doc = block && docs.get(block.spriteId);
  if (!block || !doc) return null;

  return {
    x: snap(block.x + event.delta.x / BUILDER_ZOOM),
    y: snap(block.y + event.delta.y / BUILDER_ZOOM),
    w: doc.width * doc.frames.length,
    h: doc.height,
  };
}

/**
 * Owns the composer's one drop rule: a snapped drop that would overlap another block is
 * rejected, whether it's a brand new block from the palette or an existing one being moved.
 */
export function useBuilderDnd(
  spritesheet: SpritesheetRecord,
  docs: Map<string, SpriteDocument>,
  canvasRef: RefObject<HTMLDivElement | null>,
  track: SaveStatusTracker["track"],
) {
  const persist = useCallback(
    (blocks: SpritesheetBlockRecord[]) => {
      void track(
        updateSpritesheet(spritesheet.id, { blocks }).then(() =>
          saveSpritesheetThumbnail(spritesheet.id, blocks, docs),
        ),
      );
    },
    [spritesheet.id, docs, track],
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      persist(spritesheet.blocks.filter((block) => block.id !== blockId));
    },
    [persist, spritesheet.blocks],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const data = event.active.data.current as DragData | undefined;
      const canvasEl = canvasRef.current;
      if (!data || !canvasEl || event.over?.id !== "builder-canvas") return;

      // A new placement lands its top-left corner at the cursor; a move keeps the grabbed block
      // under the cursor by applying the drag delta to where it already sits.
      const placement =
        data.type === "palette"
          ? { ...dropPoint(canvasEl, event), w: data.width * data.frameCount, h: data.height }
          : movedPlacement(spritesheet.blocks, docs, data.blockId, event);
      if (!placement) return;

      const { x, y, w, h } = placement;
      const excludeId = data.type === "block" ? data.blockId : null;
      const occupied = spritesheet.blocks
        .filter((block) => block.id !== excludeId)
        .map((block) => {
          const otherDoc = docs.get(block.spriteId);
          return otherDoc ? blockRect(block, otherDoc) : null;
        })
        .filter((rect): rect is Rect => rect !== null);

      if (occupied.some((rect) => rectsIntersect({ x, y, w, h }, rect))) return; // overlap — reject

      if (data.type === "palette") {
        const next: SpritesheetBlockRecord = { id: createId(), spriteId: data.spriteId, x, y };
        persist([...spritesheet.blocks, next]);
      } else {
        persist(
          spritesheet.blocks.map((block) =>
            block.id === data.blockId ? { ...block, x, y } : block,
          ),
        );
      }
    },
    [canvasRef, docs, persist, spritesheet.blocks],
  );

  return { handleDragEnd, removeBlock };
}
