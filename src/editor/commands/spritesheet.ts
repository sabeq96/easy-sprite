import type { SheetBlock } from "@/lib/sheetLayout";
import type { Command } from "@/editor/history";
import type { SpritesheetDocument } from "@/editor/spritesheetDocument";

/** Rough retained size of a block record, for History's memory bound. */
const BLOCK_BYTES = 128;

function sameLayout(a: SheetBlock[], b: SheetBlock[]): boolean {
  return (
    a.length === b.length &&
    a.every((block, index) => block.id === b[index].id && block.row === b[index].row)
  );
}

/**
 * Replaces the sheet's blocks. Undo carries both layouts whole: they are a few records each, so
 * nothing smaller is worth computing. Null when nothing moved.
 */
export function setBlocksCommand(
  doc: SpritesheetDocument,
  next: SheetBlock[],
  label: string,
): Command | null {
  const before = doc.blocks;
  if (sameLayout(before, next)) return null;

  doc.setBlocks(next);
  return {
    label,
    sizeBytes: (before.length + next.length) * BLOCK_BYTES,
    undo: () => doc.setBlocks(before),
    redo: () => doc.setBlocks(next),
  };
}

export function setTileSizeCommand(doc: SpritesheetDocument, tileSize: number): Command | null {
  const before = doc.tileSize;
  if (tileSize === before) return null;

  doc.setMeta({ tileSize });
  return {
    label: "Change tile size",
    sizeBytes: 0,
    undo: () => doc.setMeta({ tileSize: before }),
    redo: () => doc.setMeta({ tileSize }),
  };
}
