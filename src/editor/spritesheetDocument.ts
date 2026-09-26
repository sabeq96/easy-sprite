import type { SheetBlock } from "@/lib/sheetLayout";
import { Emitter } from "@/editor/emitter";

export interface SpritesheetDocumentInit {
  id: string;
  name: string;
  tileSize: number;
  blocks: SheetBlock[];
}

export interface SpritesheetDocumentEvents {
  /** Blocks were added, moved or removed. */
  blocks: void;
  /** Name or tile size changed. */
  meta: void;
}

export type SpritesheetRevisionChannel = keyof SpritesheetDocumentEvents;

/**
 * An open spritesheet, in memory — what the composer renders and edits, while Autosave writes it
 * back behind a debounce. The blocks array is replaced, never mutated, so its identity is an exact
 * "has the layout changed" (see SpriteDocument for why React needs that).
 */
export class SpritesheetDocument {
  readonly id: string;
  readonly events = new Emitter<SpritesheetDocumentEvents>();
  /** Monotonic counters for useSyncExternalStore — see hooks/useSpritesheetSnapshot. */
  readonly revisions: Record<SpritesheetRevisionChannel, number> = { blocks: 0, meta: 0 };

  name: string;
  tileSize: number;
  blocks: SheetBlock[];

  constructor(init: SpritesheetDocumentInit) {
    this.id = init.id;
    this.name = init.name;
    this.tileSize = init.tileSize;
    this.blocks = [...init.blocks];
  }

  setBlocks(blocks: SheetBlock[]): void {
    this.blocks = [...blocks];
    this.bump("blocks");
  }

  setMeta(patch: { name?: string; tileSize?: number }): void {
    if (patch.name !== undefined) this.name = patch.name;
    if (patch.tileSize !== undefined) this.tileSize = patch.tileSize;
    this.bump("meta");
  }

  private bump(channel: SpritesheetRevisionChannel): void {
    this.revisions[channel]++;
    this.events.emit(channel, undefined);
  }
}
