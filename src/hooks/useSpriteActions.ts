import { toast } from "sonner";
import {
  createSprite,
  duplicateSprite,
  removeSprite,
  splitSpriteIntoFrames,
  updateSprite,
  type CreateSpriteOptions,
} from "@/db/repositories/sprites";
import type { SpriteRecord } from "@/db/schema";
import type { SpriteDocument } from "@/editor/document";
import { downloadSpritePng } from "@/export/spritePng";
import { runWithToast, useAsyncAction } from "@/hooks/useAsyncAction";
import { plural } from "@/lib/format";
import type { CanvasSize } from "@/lib/validation";
import { openDocument } from "@/services/documentService";
import { importPngFiles } from "@/services/importPng";
import { saveThumbnail } from "@/services/thumbnails";

export interface SpriteEdit {
  name?: string;
  tags?: string[];
}

/**
 * Every sprite mutation the UI can start, with its user-facing feedback built in. Each one reports
 * its own failure and then resolves to `undefined`, so callers never catch.
 */
export function useSpriteActions() {
  return {
    create: (options: CreateSpriteOptions) =>
      runWithToast(() => createSprite(options), { error: "Could not create the sprite." }),

    update: (id: string, edit: SpriteEdit) =>
      runWithToast(() => updateSprite(id, edit), { error: "Could not save that change." }),

    duplicate: (sprite: SpriteRecord) =>
      runWithToast(() => duplicateSprite(sprite.id), {
        success: (copy) => `Duplicated as "${copy.name}"`,
        error: "Could not duplicate that sprite.",
      }),

    remove: (sprite: SpriteRecord) =>
      runWithToast(() => removeSprite(sprite.id), { error: "Could not delete that sprite." }),

    /** Resolves to true once split, or undefined if it failed (already reported). */
    split: (sprite: SpriteRecord, frameSize: CanvasSize, frameCount: number) =>
      runWithToast(
        async () => {
          await splitSpriteIntoFrames(sprite.id, frameSize.width, frameSize.height);
          await saveThumbnail(await openDocument(sprite.id));
          return true;
        },
        { success: () => `Split into ${plural(frameCount, "frame")}`, error: "Split failed." },
      ),

    importFiles: async (files: File[]) => {
      const result = await runWithToast(() => importPngFiles(files), { error: "Import failed." });
      if (!result) return;
      const { imported, skipped } = result;
      if (imported.length > 0) {
        toast.success(
          imported.length === 1
            ? `Imported "${imported[0].name}"`
            : `Imported ${plural(imported.length, "sprite")}`,
        );
      }
      for (const { name, reason } of skipped) toast.error(`Couldn't import "${name}": ${reason}`);
    },
  };
}

/**
 * The one-click PNG export, shared by the editor and the library. `prepare` runs first — the
 * editor flushes its autosave there so the PNG always matches what is on screen.
 */
export function useSpriteExport() {
  return useAsyncAction(
    async (source: SpriteDocument | string, prepare?: () => Promise<void>) => {
      await prepare?.();
      const doc = typeof source === "string" ? await openDocument(source) : source;
      return downloadSpritePng(doc);
    },
    { success: (filename) => `Exported ${filename}`, error: "Export failed." },
  );
}
