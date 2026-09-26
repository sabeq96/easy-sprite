import { updateSpritesheet } from "@/db/repositories/spritesheets";
import type { SpriteDocument } from "@/editor/document";
import type { SpritesheetDocument } from "@/editor/spritesheetDocument";
import type { SaveSource } from "@/services/autosave";
import { openDocument } from "@/services/documentService";
import { saveSpritesheetThumbnail } from "@/services/thumbnails";

/**
 * A spritesheet's save: the whole record (name, tile size, blocks) in one write, then a thumbnail
 * composed from its sprites. Sprites are opened once and kept for later thumbnails; one that
 * can't be opened (deleted elsewhere) is left out of the thumbnail rather than failing the save.
 */
export function spritesheetSaveSource(doc: SpritesheetDocument): SaveSource {
  let dirty = false;
  const sprites = new Map<string, SpriteDocument>();

  const openSprites = async () => {
    const missing = [...new Set(doc.blocks.map((block) => block.spriteId))].filter(
      (id) => !sprites.has(id),
    );
    await Promise.all(
      missing.map((id) =>
        openDocument(id).then(
          (sprite) => void sprites.set(id, sprite),
          () => undefined,
        ),
      ),
    );
    return sprites;
  };

  return {
    subscribe: (onChange) => {
      const markDirty = () => {
        dirty = true;
        onChange();
      };
      const offs = [doc.events.on("blocks", markDirty), doc.events.on("meta", markDirty)];
      return () => offs.forEach((off) => off());
    },

    write: () => {
      if (!dirty) return "clean";
      dirty = false;
      return save();
    },
  };

  async function save(): Promise<void> {
    const { name, tileSize, blocks } = doc;
    try {
      await updateSpritesheet(doc.id, { name, tileSize, blocks });
    } catch (error) {
      dirty = true; // the next flush retries
      throw error;
    }
    await saveSpritesheetThumbnail(doc.id, blocks, await openSprites());
  }
}
