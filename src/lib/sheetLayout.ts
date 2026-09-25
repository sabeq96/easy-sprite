import type { Rect } from "@/lib/rect";
import { toRows, type RowBlock } from "@/lib/sheetRows";

/**
 * Structural shapes, so this stays a pure module. In practice a block is a
 * `SpritesheetBlockRecord` and a sprite is a `SpriteRecord` or a `SpriteDocument`.
 */
export interface SheetBlock extends RowBlock {
  spriteId: string;
}

export interface SpriteDimensions {
  width: number;
  height: number;
  frames: readonly unknown[];
}

/** A block's footprint: its sprite's frames laid out as one horizontal strip. */
export interface BlockSize {
  w: number;
  h: number;
}

/** Footprints keyed by sprite id — see `sizesFromDocs` / `sizesFromRecords` for the two sources. */
export type BlockSizes = ReadonlyMap<string, BlockSize>;

/** Export's source: the documents it is about to draw anyway. */
export function sizesFromDocs(docs: ReadonlyMap<string, SpriteDimensions>): BlockSizes {
  return new Map(
    [...docs].map(([id, doc]) => [id, { w: doc.width * doc.frames.length, h: doc.height }]),
  );
}

/** The UI's source: a record knows its size the moment the library query returns, well before
 *  its document has been opened — so a block never renders at a placeholder size and then jumps. */
export function sizesFromRecords(sprites: readonly (SpriteDimensions & { id: string })[]): BlockSizes {
  return new Map(
    sprites.map((sprite) => [sprite.id, { w: sprite.width * sprite.frames.length, h: sprite.height }]),
  );
}

export interface PackedBlock extends Rect {
  id: string;
  spriteId: string;
  row: number;
}

export interface PackedSheet {
  blocks: PackedBlock[];
  /** One rect per row, in order. */
  rows: Rect[];
  width: number;
  height: number;
}

/**
 * The sheet's geometry, and the only place it is computed: rows stack top-down with no gap, blocks
 * sit left-to-right inside a row with no gap, and a row is as tall as its tallest block.
 *
 * This mirrors in arithmetic exactly what the composer's flex rows do in CSS — the browser lays
 * out what you see, this lays out what gets exported, and a browser test holds the two together.
 */
export function packSheet(blocks: SheetBlock[], sizes: BlockSizes): PackedSheet {
  const packed: PackedBlock[] = [];
  const rows: Rect[] = [];
  let y = 0;

  for (const row of toRows(blocks)) {
    let x = 0;
    let height = 0;

    for (const block of row) {
      const size = sizes.get(block.spriteId);
      if (!size) continue; // not read yet, or a dangling reference — skip defensively
      packed.push({ id: block.id, spriteId: block.spriteId, row: rows.length, ...size, x, y });
      x += size.w;
      height = Math.max(height, size.h);
    }

    rows.push({ x: 0, y, w: x, h: height });
    y += height;
  }

  return { blocks: packed, rows, width: Math.max(0, ...rows.map((rect) => rect.w)), height: y };
}

/** For callers that only need the sheet's size. */
export function computeBuilderBounds(
  blocks: SheetBlock[],
  sizes: BlockSizes,
): { width: number; height: number } {
  const { width, height } = packSheet(blocks, sizes);
  return { width, height };
}
