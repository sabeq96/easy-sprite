import { expect } from "vitest";
import { db } from "@/db/db";
import { getSpritesheet } from "@/db/repositories/spritesheets";
import { sizesFromRecords } from "@/lib/sheetLayout";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";

/**
 * Waits until every placed block of `sheetId` is on screen at its sprite's real size. Sprite sizes
 * come from their own live query, and until it lands a block renders at a placeholder size — so
 * geometry measured any earlier (a drag target, a width assertion) is about to change under it.
 */
export async function blocksSized(sheetId: string): Promise<void> {
  const { blocks } = await getSpritesheet(sheetId);
  const sizes = sizesFromRecords(await db.sprites.toArray());
  await expect
    .poll(() => {
      const zoom = useBuilderViewStore.getState().zoom;
      return blocks.every((block) => {
        const element = document.querySelector(`[data-block-id="${block.id}"]`);
        const size = sizes.get(block.spriteId);
        return (
          !!element &&
          !!size &&
          Math.round(element.getBoundingClientRect().width) === size.w * zoom &&
          Math.round(element.getBoundingClientRect().height) === size.h * zoom
        );
      });
    })
    .toBe(true);
}

/**
 * Waits for a composer edit's whole save — the blocks, then the thumbnail rendered from them — to
 * land, as the save badge reports it. A test that ended as soon as the blocks were written would
 * leave the thumbnail write in flight when teardown closes the database under it.
 */
export async function builderSaveSettled(): Promise<void> {
  await expect
    .poll(() => document.querySelector('[role="status"][aria-label]')?.getAttribute("aria-label"))
    .toBe("Saved");
}
