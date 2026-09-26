import type { SpriteDocument } from "@/editor/document";
import type { History } from "@/editor/history";
import type { SpritesheetDocument } from "@/editor/spritesheetDocument";
import type { Autosave } from "@/services/autosave";

declare global {
  interface Window {
    /** Dev-only handle set by DocumentProvider — the same one used by scripts/smoke.mjs. */
    __spriteEditor?: { doc: SpriteDocument; history: History; autosave: Autosave };
    /** Dev-only handle set by SpritesheetProvider. */
    __spritesheetEditor?: { doc: SpritesheetDocument; history: History; autosave: Autosave };
  }
}

export {};
