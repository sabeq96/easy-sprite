/// <reference types="@vitest/browser-playwright" />
import type { BrowserCommand } from "vitest/node";

/**
 * Moves Playwright's mouse off the page. The mouse outlives a test, so without this the next test
 * mounts under wherever the last one left it and opens that spot's tooltip over its own targets.
 */
export const parkPointer: BrowserCommand<[]> = async (ctx) => {
  if (ctx.provider.name !== "playwright") return;
  await ctx.page.mouse.move(-1, -1);
};

declare module "vitest/browser" {
  interface BrowserCommands {
    parkPointer: () => Promise<void>;
  }
}
