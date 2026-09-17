import { expect, test } from "vitest";
import { AppRoutes } from "@/app/routes";
import { createSprite } from "@/db/repositories/sprites";
import { useEditorStore } from "@/stores/useEditorStore";
import { render } from "@test/render";
import { clickSpritePixel } from "@test/pointer";

test("clicking with the pencil tool paints a pixel", async () => {
  const sprite = await createSprite({ width: 16, height: 16 });
  const screen = render(<AppRoutes />, { route: `/sprites/${sprite.id}` });

  const canvas = screen.getByRole("application", { name: "Sprite canvas" });
  await expect.element(canvas).toBeVisible();

  // The sprite is fitted to its container by a ResizeObserver that fires after mount; clicking
  // before it runs would use the default (unfitted) viewport.
  await expect.poll(() => useEditorStore.getState().containerSize.width > 0).toBe(true);

  clickSpritePixel(canvas.element(), useEditorStore.getState().viewport, { x: 8, y: 8 });

  await expect
    .poll(() => {
      const doc = window.__spriteEditor?.doc;
      const cel = doc?.getCel(doc.layers[0].id, doc.frames[0].id);
      return cel?.pixels.some((channel) => channel !== 0) ?? false;
    })
    .toBe(true);
});
