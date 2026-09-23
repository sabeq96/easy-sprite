import { expect } from "vitest";

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
