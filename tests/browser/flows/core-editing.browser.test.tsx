import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { AppRoutes } from "@/app/routes";
import { db } from "@/db/db";
import { createPalette } from "@/db/repositories/palettes";
import { createSprite } from "@/db/repositories/sprites";
import { IS_APPLE } from "@/lib/keys";
import { useEditorStore } from "@/stores/useEditorStore";
import { render } from "@test/render";
import { clickSpritePixel } from "@test/pointer";

const UNDO = IS_APPLE ? "{Meta>}z{/Meta}" : "{Control>}z{/Control}";
const REDO = IS_APPLE ? "{Meta>}{Shift>}z{/Shift}{/Meta}" : "{Control>}{Shift>}z{/Shift}{/Control}";
const SELECT_ALL = IS_APPLE ? "{Meta>}a{/Meta}" : "{Control>}a{/Control}";

/** Renders the real app at a freshly seeded sprite and waits for the canvas to be interactive. */
async function openEditor(width = 16, height = 16) {
  const sprite = await createSprite({ width, height });
  const screen = render(<AppRoutes />, { route: `/sprites/${sprite.id}` });

  const canvas = screen.getByRole("application", { name: "Sprite canvas" });
  await expect.element(canvas).toBeVisible();
  await expect.poll(() => useEditorStore.getState().containerSize.width > 0).toBe(true);

  return { screen, canvas: canvas.element(), spriteId: sprite.id };
}

function countPaintedPixels(): number {
  const doc = window.__spriteEditor?.doc;
  if (!doc) return 0;
  const cel = doc.getCel(doc.layers[0].id, doc.frames[0].id);
  if (!cel) return 0;
  let painted = 0;
  for (let i = 3; i < cel.pixels.length; i += 4) if (cel.pixels[i] > 0) painted++;
  return painted;
}

test("drawing with the pencil, undo and redo", async () => {
  const { canvas } = await openEditor();
  const { viewport } = useEditorStore.getState();

  clickSpritePixel(canvas, viewport, { x: 8, y: 8 });
  await expect.poll(countPaintedPixels).toBeGreaterThan(0);

  await userEvent.keyboard(UNDO);
  await expect.poll(countPaintedPixels).toBe(0);

  await userEvent.keyboard(REDO);
  await expect.poll(countPaintedPixels).toBeGreaterThan(0);
});

test("the bucket tool fills the whole (empty) canvas", async () => {
  const { screen, canvas } = await openEditor();
  const { viewport } = useEditorStore.getState();

  await userEvent.click(screen.getByRole("button", { name: "Paint bucket" }));
  clickSpritePixel(canvas, viewport, { x: 8, y: 8 });

  await expect.poll(countPaintedPixels).toBe(16 * 16);
});

test("layers and frames panels reflect document structure", async () => {
  const { screen } = await openEditor();

  // Anchored to the toggle's whole name: the draggable row is itself role="button", and its
  // computed name also starts with "Hide Layer 1…".
  await expect.element(screen.getByRole("button", { name: /^(Hide|Show) Layer \d+$/u })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "New layer" }));
  await expect
    .poll(() => screen.getByRole("button", { name: /^(Hide|Show) Layer \d+$/u }).elements().length)
    .toBe(2);

  await userEvent.click(screen.getByRole("button", { name: "New frame" }));
  await expect
    .poll(() => screen.getByRole("button", { name: /^Frame \d+$/ }).elements().length)
    .toBe(2);
});

test("select all + delete clears the canvas, and undo restores it", async () => {
  const { canvas } = await openEditor();
  const { viewport } = useEditorStore.getState();

  clickSpritePixel(canvas, viewport, { x: 8, y: 8 });
  await expect.poll(countPaintedPixels).toBeGreaterThan(0);

  await userEvent.keyboard(SELECT_ALL);
  await userEvent.keyboard("{Delete}");
  await expect.poll(countPaintedPixels).toBe(0);

  await userEvent.keyboard(UNDO);
  await expect.poll(countPaintedPixels).toBeGreaterThan(0);
});

test("clicking a tool activates it and updates aria-pressed on both buttons", async () => {
  const { screen } = await openEditor();
  const pencil = screen.getByRole("button", { name: "Pencil", exact: true });
  const eraser = screen.getByRole("button", { name: "Eraser", exact: true });

  await expect.element(pencil).toHaveAttribute("aria-pressed", "true");

  await userEvent.click(eraser);

  await expect.element(eraser).toHaveAttribute("aria-pressed", "true");
  await expect.element(pencil).toHaveAttribute("aria-pressed", "false");
});

test("? opens the shortcut cheat sheet listing a bound command", async () => {
  const { screen } = await openEditor();

  await userEvent.keyboard("?");

  await expect.element(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await expect.element(screen.getByText("Undo")).toBeVisible();
});

test("the cheat sheet lists tool gestures once, and feature keys inside their command group", async () => {
  const { screen } = await openEditor();

  await userEvent.keyboard("?");
  const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });

  await expect.element(dialog.getByRole("heading", { name: /Select & move/ })).toBeVisible();
  await expect.element(dialog.getByText(/^Duplicate selection/)).toBeVisible();
  // Every tool is one row of a single Tools section, the picker's hold key alongside its own.
  await expect.element(dialog.getByRole("heading", { name: "Tools" })).toBeVisible();
  await expect.element(dialog.getByText(/^Hold /)).toBeInTheDocument();
  expect(dialog.getByRole("heading", { name: "Pencil" }).elements()).toHaveLength(0);
  await expect.element(dialog.getByText("Pick primary", { exact: true })).toBeInTheDocument();
  // Selection commands are listed once, in the Select & move section, not again under Edit.
  expect(dialog.getByText("Deselect", { exact: true }).elements()).toHaveLength(1);
  expect(dialog.getByRole("heading", { name: /^(Palette|Colors|Canvas)$/ }).elements()).toHaveLength(0);
});

test("hovering the palette shows its 1–9 keys", async () => {
  const palette = await createPalette("Hints", ["#ff0000", "#00ff00"]);
  const { screen } = await openEditor();
  useEditorStore.getState().setActivePalette(palette.id);

  await userEvent.hover(screen.getByRole("button", { name: /^Color #ff0000/ }).first());

  await expect.element(screen.getByText("Pick primary", { exact: true })).toBeVisible();
});

test("a sprite survives a remount (the persistence a page reload would exercise)", async () => {
  const { screen, canvas, spriteId } = await openEditor();
  const { viewport } = useEditorStore.getState();

  clickSpritePixel(canvas, viewport, { x: 8, y: 8 });
  await expect.poll(countPaintedPixels).toBeGreaterThan(0);

  // A real page reload would tear down the whole JS context; unmounting and remounting the
  // same route exercises the part that matters here — that the pixel round-tripped through
  // IndexedDB rather than only existing in the live in-memory document.
  screen.unmount();
  // Unmounting flushes the save — cels, then the thumbnail last. Waiting for the thumbnail means
  // the remount reads a finished save, and no write is still in flight when teardown closes the
  // database (which would surface as an unhandled DatabaseClosedError).
  await expect.poll(async () => (await db.sprites.get(spriteId))?.thumbnail).toBeTruthy();

  const reopened = render(<AppRoutes />, { route: `/sprites/${spriteId}` });
  await expect
    .element(reopened.getByRole("application", { name: "Sprite canvas" }))
    .toBeVisible();
  await expect.poll(countPaintedPixels).toBeGreaterThan(0);
});
