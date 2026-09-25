import { useRef, useState } from "react";
import type {
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/dom";
import { updateSpritesheet } from "@/db/repositories/spritesheets";
import type { SpritesheetBlockRecord, SpritesheetRecord } from "@/db/schema";
import type { SpriteDocument } from "@/editor/document";
import type { BlockSizes } from "@/lib/sheetLayout";
import { useDocumentCache } from "@/hooks/useDocumentCache";
import { useOptimisticOrder } from "@/hooks/useOptimisticOrder";
import type { SaveStatusTracker } from "@/hooks/useSaveStatus";
import { createId } from "@/lib/id";
import {
  appendToRow,
  draftToRows,
  dropBlock,
  fromRows,
  placeBeside,
  toRowDraft,
  withNewRow,
  withoutBlock,
  type RowDraft,
} from "@/lib/sheetRows";
import { openDocument } from "@/services/documentService";
import { saveSpritesheetThumbnail } from "@/services/thumbnails";

/**
 * A palette drag carries the sprite's name and thumbnail so the drag preview can be the dock tile
 * itself. Its footprint on the sheet comes from the sprite record, like every other block's.
 */
export type DragData =
  | { type: "palette"; spriteId: string; name: string; thumbnail: Blob | null }
  | { type: "block"; blockId: string };

/** The dock is a drop target too: a block dragged back onto it leaves the sheet. */
export const PALETTE_DROP_ID = "builder-palette";
export const gutterDropId = (index: number) => `gutter-${index}`;

type DropTarget =
  | { kind: "dock" }
  | { kind: "gutter"; index: number }
  | { kind: "row"; key: string }
  | { kind: "block"; blockId: string };

function parseTarget(id: string, draft: RowDraft): DropTarget {
  if (id === PALETTE_DROP_ID) return { kind: "dock" };
  if (id.startsWith("gutter-")) return { kind: "gutter", index: Number(id.slice("gutter-".length)) };
  if (id in draft) return { kind: "row", key: id };
  return { kind: "block", blockId: id };
}

type DragOperation = DragOverEvent["operation"];

/** Whether the pointer is past the horizontal middle of the element it is over. */
function isPastMiddle(operation: DragOperation): boolean {
  const rect = operation.target?.element?.getBoundingClientRect();
  return rect ? operation.position.current.x > rect.left + rect.width / 2 : false;
}

function sameLayout(a: SpritesheetBlockRecord[], b: SpritesheetBlockRecord[]): boolean {
  return (
    a.length === b.length &&
    a.every((block, index) => block.id === b[index].id && block.row === b[index].row)
  );
}

export interface BuilderRowView {
  key: string;
  blocks: SpritesheetBlockRecord[];
  /**
   * During a drag, the tallest this row has been since the drag began, in sprite px. A row that
   * shrinks mid-drag — emptied by the block being dragged out of it, or left by a tall ghost —
   * would pull every row below it up under the pointer, and the next pointer move would carry the
   * block one row further than aimed. Rows only settle to their real heights on drop.
   */
  heldHeight?: number;
}

/** Each draft row's height in sprite px: its tallest block. */
function draftHeights(
  draft: RowDraft,
  spriteOf: ReadonlyMap<string, SpritesheetBlockRecord>,
  sizes: BlockSizes,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(draft).map(([key, ids]) => [
      key,
      Math.max(0, ...ids.map((id) => sizes.get(spriteOf.get(id)?.spriteId ?? "")?.h ?? 0)),
    ]),
  );
}

/**
 * The cached documents plus any the sheet uses that haven't loaded yet — a sprite dropped the
 * instant it was dragged in may not have. The thumbnail skips a sprite with no document, which
 * would leave it out and shift every block after it.
 */
async function withDocsFor(
  blocks: SpritesheetBlockRecord[],
  docs: Map<string, SpriteDocument>,
): Promise<Map<string, SpriteDocument>> {
  const missing = [...new Set(blocks.map((block) => block.spriteId))].filter((id) => !docs.has(id));
  if (missing.length === 0) return docs;
  const opened = await Promise.all(missing.map((id) => openDocument(id).then((doc) => [id, doc] as const)));
  return new Map([...docs, ...opened]);
}

function maxHeights(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(b).map(([key, h]) => [key, Math.max(h, a[key] ?? 0)]));
}

/**
 * The composer's drag model. Between drags the sheet renders straight from its stored blocks; for
 * the length of a drag it renders from a draft (row key → block ids) that follows the pointer, so
 * the rows open up where the block will land.
 *
 * - Every placement is made here, by one rule — before or after the block under the pointer,
 *   by which half of it the pointer is in — whether the block is moving within its row, into
 *   another, or being dragged in from the dock. The library's own optimistic sort is turned off
 *   (`preventDefault`): it swaps the moment the pointer enters a neighbour, so a drop just inside a
 *   block's right half would land before it within a row but after it across rows. It also can't
 *   move items between rows, nor open a gap for an item that isn't sortable yet. The library still
 *   animates every block to its new slot.
 * - A dragged-in sprite is a *ghost* block with an id minted at drag start, so its stand-in keeps
 *   one identity for the whole drag.
 * - **Gutters** (the strips between rows) and the **dock** only light up; what they do is decided
 *   on drop — a new row, or removal.
 */
export function useBuilderDnd(
  spritesheet: SpritesheetRecord,
  sizes: BlockSizes,
  track: SaveStatusTracker["track"],
) {
  const stored = useOptimisticOrder(spritesheet.blocks);
  const [draft, setDraft] = useState<RowDraft | null>(null);
  const [held, setHeld] = useState<Record<string, number>>({});
  const heldRef = useRef<Record<string, number>>({});
  // The handlers read these refs, not state: the library runs dragover/dragend inside a transition,
  // so the last update may not have rendered yet when a quick release lands.
  const draftRef = useRef<RowDraft | null>(null);
  const ghostRef = useRef<SpritesheetBlockRecord | null>(null);
  const [ghost, setGhost] = useState<SpritesheetBlockRecord | null>(null);

  const lookup = new Map(stored.items.map((block) => [block.id, block]));
  if (ghost) lookup.set(ghost.id, ghost);
  const rows: BuilderRowView[] = Object.entries(draft ?? toRowDraft(stored.items)).map(
    ([key, ids]) => ({
      key,
      blocks: ids.flatMap((id) => {
        const block = lookup.get(id);
        return block ? [block] : [];
      }),
      heldHeight: draft ? held[key] : undefined,
    }),
  );

  // Opened for everything the sheet *shows*, ghost included, so a sprite being dragged in starts
  // loading its pixels before it is even dropped.
  const docs = useDocumentCache(rows.flatMap((row) => row.blocks.map((block) => block.spriteId)));

  const showDraft = (next: RowDraft | null) => {
    if (next === draftRef.current) return;
    draftRef.current = next;
    setDraft(next);

    const records = new Map(stored.items.map((block) => [block.id, block]));
    if (ghostRef.current) records.set(ghostRef.current.id, ghostRef.current);
    heldRef.current = next ? maxHeights(heldRef.current, draftHeights(next, records, sizes)) : {};
    setHeld(heldRef.current);
  };

  const persist = (next: SpritesheetBlockRecord[]) => {
    stored.propose(next);
    track(
      updateSpritesheet(spritesheet.id, { blocks: next })
        .then(() => withDocsFor(next, docs))
        .then((all) => saveSpritesheetThumbnail(spritesheet.id, next, all)),
    ).catch(() => {
      // Already reported: the save badge turns to "Save failed".
    });
  };

  const handleDragStart = ({ operation }: DragStartEvent) => {
    const data = operation.source?.data as DragData | undefined;
    // Minted here, outside any state updater: StrictMode runs updaters twice.
    const minted =
      data?.type === "palette" ? { id: createId(), spriteId: data.spriteId, row: 0 } : null;
    ghostRef.current = minted;
    setGhost(minted);
    showDraft(toRowDraft(stored.items));
  };

  /** Follows the pointer: re-run on every target change *and* every move within a target, since
   *  which half of a block the pointer is in decides the slot. */
  const place = (operation: DragOperation) => {
    const { source, target } = operation;
    const current = draftRef.current;
    const data = source?.data as DragData | undefined;
    if (!current || !data) return;

    const movingId = data.type === "palette" ? ghostRef.current?.id : data.blockId;
    if (!movingId) return;
    const isGhost = data.type === "palette";

    const over = target ? parseTarget(String(target.id), current) : null;

    // Off the sheet, or over a strip whose meaning is only decided on drop. A block being dragged
    // stays where it last was (unmounting a drag source mid-drag is not safe); the ghost belongs to
    // no one, so it leaves and the row closes up behind it.
    if (!over || over.kind === "dock" || over.kind === "gutter") {
      if (isGhost) showDraft(withoutBlock(current, movingId));
      return;
    }

    if (over.kind === "row") {
      showDraft(appendToRow(current, movingId, over.key));
      return;
    }

    if (over.blockId === movingId) return; // over its own slot
    showDraft(placeBeside(current, movingId, over.blockId, isPastMiddle(operation)));
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Every placement is made by `place`; the library's own optimistic sort stays out of it.
    event.preventDefault();
    place(event.operation);
  };

  // No preventDefault here — on a move event it would stop the drag itself from following the pointer.
  const handleDragMove = (event: DragMoveEvent) => place(event.operation);

  const handleDragEnd = ({ operation, canceled }: DragEndEvent) => {
    // One last placement at the release point: pointer moves are processed a frame at a time, so a
    // quick release can land before the last move was — and the drop must go where it was let go.
    if (!canceled) place(operation);
    const current = draftRef.current;
    const pending = ghostRef.current;
    const data = operation.source?.data as DragData | undefined;
    ghostRef.current = null;
    setGhost(null);
    showDraft(null);
    if (canceled || !current || !data) return;

    const base = stored.items;
    const movingId = data.type === "palette" ? pending?.id : data.blockId;
    if (!movingId) return;

    const over = operation.target ? parseTarget(String(operation.target.id), current) : null;

    if (over?.kind === "dock") {
      if (data.type === "block") persist(dropBlock(base, data.blockId));
      return;
    }

    const records = new Map(base.map((block) => [block.id, block]));
    if (pending) records.set(pending.id, pending);

    // What the drag showed is what lands; a gutter is the one target that means something the
    // draft didn't already show — a new row, opened on drop.
    const landed = over?.kind === "gutter" ? withNewRow(current, movingId, over.index) : current;
    const next = fromRows(draftToRows(landed, records));
    if (!sameLayout(next, base)) persist(next);
  };

  return {
    /** The committed blocks — what the export, status bar and chrome describe. */
    blocks: stored.items,
    /** What the sheet shows right now, trailing empty row included. */
    rows,
    docs,
    ghostId: ghost?.id ?? null,
    isDragging: draft !== null,
    handleDragStart,
    handleDragOver,
    handleDragMove,
    handleDragEnd,
    removeBlock: (blockId: string) => persist(dropBlock(stored.items, blockId)),
  };
}
