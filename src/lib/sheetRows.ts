/**
 * The row model of a spritesheet: a flat, ordered list of blocks, each carrying its row index.
 * Generic over the block's shape so this stays a pure module — in practice it is always a
 * `SpritesheetBlockRecord`.
 */
export interface RowBlock {
  id: string;
  row: number;
}

export type SheetRows<T extends RowBlock> = T[][];

/**
 * A block's row, read defensively: anything that isn't a non-negative integer is row 0. Blocks
 * stored before rows existed carry `x`/`y` instead, and a backup can bring those back — they
 * collapse into the first row rather than taking the composer down.
 */
function rowOf(block: RowBlock): number {
  return Number.isInteger(block.row) && block.row >= 0 ? block.row : 0;
}

/** Blocks → rows, indexed by row. Order inside a row is the array's own order. */
export function toRows<T extends RowBlock>(blocks: T[]): SheetRows<T> {
  const count = blocks.reduce((max, block) => Math.max(max, rowOf(block) + 1), 0);
  const rows: SheetRows<T> = Array.from({ length: count }, () => []);
  for (const block of blocks) rows[rowOf(block)].push(block);
  return rows;
}

/**
 * Rows → blocks: drops empty rows and rewrites every row index, so rows stay 0..n with no holes.
 *
 * This is the only writer of `row`, which is why callers never set it themselves. Blocks whose
 * row did not change are returned by identity, so React keys and the drag library's measurement
 * cache survive an edit that did not touch them.
 */
export function fromRows<T extends RowBlock>(rows: SheetRows<T>): T[] {
  return rows
    .filter((row) => row.length > 0)
    .flatMap((row, index) =>
      row.map((block) => (block.row === index ? block : { ...block, row: index })),
    );
}

export interface RowTarget {
  row: number;
  /** Insertion point within the row, counted once the moving block is out of it. */
  index: number;
}

/** Moves an existing block, or inserts a new one, so it sits at `target` — then renormalises. */
export function placeBlock<T extends RowBlock>(blocks: T[], block: T, target: RowTarget): T[] {
  const rows = toRows(blocks).map((row) => row.filter((entry) => entry.id !== block.id));
  while (rows.length <= target.row) rows.push([]);
  const row = rows[target.row];
  row.splice(Math.min(Math.max(target.index, 0), row.length), 0, block);
  return fromRows(rows);
}

/** Inserts a new row at `row`, pushing the rows at and below it down, with `block` alone in it. */
export function insertRow<T extends RowBlock>(blocks: T[], block: T, row: number): T[] {
  const rows = toRows(blocks).map((entry) => entry.filter((other) => other.id !== block.id));
  rows.splice(Math.min(Math.max(row, 0), rows.length), 0, [block]);
  return fromRows(rows);
}

/** Removes a block, collapsing its row if it was the last one in it. */
export function dropBlock<T extends RowBlock>(blocks: T[], blockId: string): T[] {
  return fromRows(toRows(blocks).map((row) => row.filter((block) => block.id !== blockId)));
}

/**
 * The sheet for the length of one drag: row key → block ids, plus one empty trailing row.
 *
 * Keys are positional (`row-0`, `row-1`, …) and fixed from drag start to drop — a row emptied
 * mid-drag stays as an empty list, so nothing renumbers under the drag library's feet (a row's key
 * is its sortable group). `fromRows` collapses the empties when the draft is committed.
 */
export type RowDraft = Record<string, string[]>;

export const rowKey = (index: number) => `row-${index}`;

export function toRowDraft(blocks: RowBlock[]): RowDraft {
  const rows = [...toRows(blocks), []];
  return Object.fromEntries(rows.map((row, index) => [rowKey(index), row.map((block) => block.id)]));
}

/** Back to records, in draft order; ids with no record (none, in practice) are dropped. */
export function draftToRows<T extends RowBlock>(
  draft: RowDraft,
  lookup: ReadonlyMap<string, T>,
): SheetRows<T> {
  return Object.values(draft).map((ids) =>
    ids.flatMap((id) => {
      const block = lookup.get(id);
      return block ? [block] : [];
    }),
  );
}

export function rowOfBlock(draft: RowDraft, blockId: string): string | undefined {
  return Object.keys(draft).find((key) => draft[key].includes(blockId));
}

export function withoutBlock(draft: RowDraft, blockId: string): RowDraft {
  if (!rowOfBlock(draft, blockId)) return draft;
  return Object.fromEntries(
    Object.entries(draft).map(([key, ids]) => [key, ids.filter((id) => id !== blockId)]),
  );
}

/** Puts `blockId` last in `key`'s row. Returns the same draft when it already is. */
export function appendToRow(draft: RowDraft, blockId: string, key: string): RowDraft {
  if (draft[key]?.at(-1) === blockId) return draft;
  const next = withoutBlock(draft, blockId);
  return { ...next, [key]: [...next[key], blockId] };
}

/** Puts `blockId` directly before or after `besideId`. Returns the same draft when it already is. */
export function placeBeside(
  draft: RowDraft,
  blockId: string,
  besideId: string,
  after: boolean,
): RowDraft {
  const key = rowOfBlock(draft, besideId);
  if (!key) return draft;

  const current = draft[key];
  const neighbour = current[current.indexOf(besideId) + (after ? 1 : -1)];
  if (neighbour === blockId) return draft;

  const next = withoutBlock(draft, blockId);
  const row = [...next[key]];
  row.splice(row.indexOf(besideId) + (after ? 1 : 0), 0, blockId);
  return { ...next, [key]: row };
}

/** A new row holding only `blockId`, inserted above the draft row at `index`. */
export function withNewRow(draft: RowDraft, blockId: string, index: number): RowDraft {
  const rows = Object.values(withoutBlock(draft, blockId));
  rows.splice(Math.min(Math.max(index, 0), rows.length), 0, [blockId]);
  return Object.fromEntries(rows.map((ids, position) => [rowKey(position), ids]));
}
