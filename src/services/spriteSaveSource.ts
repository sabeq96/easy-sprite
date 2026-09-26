import { THUMBNAIL_THROTTLE_MS } from "@/constants/storage";
import { flushCels } from "@/db/repositories/cels";
import type { CelData, SpriteDocument } from "@/editor/document";
import type { SaveSource } from "@/services/autosave";
import { saveDocumentStructure } from "@/services/documentService";
import { saveThumbnail } from "@/services/thumbnails";

/**
 * A sprite's save: the cels painted since the last write, its structure and metadata when those
 * changed, and a thumbnail at most every THUMBNAIL_THROTTLE_MS.
 */
export function spriteSaveSource(doc: SpriteDocument): SaveSource {
  let structureDirty = false;
  let lastThumbnailAt = 0;

  return {
    subscribe: (onChange) => {
      const markStructure = () => {
        structureDirty = true;
        onChange();
      };
      const offs = [
        doc.events.on("pixels", onChange),
        doc.events.on("structure", markStructure),
        doc.events.on("meta", markStructure),
      ];
      return () => offs.forEach((off) => off());
    },

    write: () => {
      const dirty = doc.takeDirtyCels();
      const needsStructure = structureDirty;
      structureDirty = false;
      if (dirty.length === 0 && !needsStructure) return "clean";
      return save(dirty, needsStructure);
    },
  };

  async function save(dirty: CelData[], needsStructure: boolean): Promise<void> {
    try {
      if (dirty.length) await flushCels(dirty.map((cel) => ({ ...cel, spriteId: doc.id })));
      if (needsStructure) await saveDocumentStructure(doc);
    } catch (error) {
      // Put the structural work back so the next flush retries instead of losing it.
      structureDirty ||= needsStructure;
      throw error;
    }

    const now = Date.now();
    if (now - lastThumbnailAt < THUMBNAIL_THROTTLE_MS) return;
    lastThumbnailAt = now;
    await saveThumbnail(doc);
  }
}
