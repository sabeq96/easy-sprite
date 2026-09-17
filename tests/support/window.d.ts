import type { SpriteDocument } from "@/editor/document";
import type { History } from "@/editor/history";

declare global {
  interface Window {
    /** Dev-only handle set by DocumentProvider — the same one used by scripts/smoke.mjs. */
    __spriteEditor?: { doc: SpriteDocument; history: History };
  }
}

export {};
