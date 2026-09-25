import type { SpriteDocument } from "@/editor/document";
import type { History } from "@/editor/history";
import type { AutosaveController } from "@/services/autosave";

declare global {
  interface Window {
    /** Dev-only handle set by DocumentProvider — the same one used by scripts/smoke.mjs. */
    __spriteEditor?: { doc: SpriteDocument; history: History; autosave: AutosaveController };
  }
}

export {};
