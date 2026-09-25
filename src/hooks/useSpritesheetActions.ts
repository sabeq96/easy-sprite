import {
  createSpritesheet,
  removeSpritesheet,
  updateSpritesheet,
  type CreateSpritesheetOptions,
} from "@/db/repositories/spritesheets";
import type { SpritesheetBlockRecord, SpritesheetRecord } from "@/db/schema";
import type { SpriteDocument } from "@/editor/document";
import { downloadBuilderSheetPng } from "@/export/spritesheetBuilder";
import { runWithToast, useAsyncAction } from "@/hooks/useAsyncAction";

export interface SpritesheetEdit {
  name?: string;
  tags?: string[];
}

/**
 * Every spritesheet mutation the UI can start, with its user-facing feedback built in. Each one
 * reports its own failure and then resolves to `undefined`, so callers never catch.
 */
export function useSpritesheetActions() {
  return {
    create: (options: CreateSpritesheetOptions) =>
      runWithToast(() => createSpritesheet(options), { error: "Could not create the spritesheet." }),

    update: (id: string, edit: SpritesheetEdit) =>
      runWithToast(() => updateSpritesheet(id, edit), { error: "Could not save that change." }),

    remove: (spritesheet: SpritesheetRecord) =>
      runWithToast(() => removeSpritesheet(spritesheet.id), {
        error: "Could not delete that spritesheet.",
      }),
  };
}

/** The one-click sheet export: every placed block composed onto one PNG. */
export function useSpritesheetExport() {
  return useAsyncAction(
    (name: string, blocks: SpritesheetBlockRecord[], docs: Map<string, SpriteDocument>) =>
      downloadBuilderSheetPng(name, blocks, docs),
    { success: (filename) => `Exported ${filename}`, error: "Export failed." },
  );
}
