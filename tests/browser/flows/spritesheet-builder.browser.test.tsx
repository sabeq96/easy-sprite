import { expect, test, vi } from "vitest";
import { page, userEvent } from "@vitest/browser/context";
import { AppRoutes } from "@/app/routes";
import { createSprite } from "@/db/repositories/sprites";
import {
  createSpritesheet,
  getSpritesheet,
  updateSpritesheet,
} from "@/db/repositories/spritesheets";
import { builderSaveSettled } from "@test/builder";
import { render } from "@test/render";

test("creating a spritesheet from the library opens the composer, and it lists with a sheet badge", async () => {
  const screen = render(<AppRoutes />, { route: "/sprites" });

  // "New spritesheet" lives behind the create button's chevron, next to the main "New sprite".
  await userEvent.click(screen.getByRole("button", { name: "More ways to create" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "New spritesheet" }));
  await expect.element(screen.getByRole("dialog", { name: "New spritesheet" })).toBeVisible();

  await userEvent.fill(screen.getByLabelText("Name"), "Scene sheet");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  await expect.element(screen.getByLabelText("Spritesheet name")).toHaveValue("Scene sheet");

  await userEvent.click(screen.getByRole("button", { name: "Back to sprites" }));
  await expect.element(screen.getByRole("button", { name: "Open Scene sheet" })).toBeVisible();
  await expect.element(screen.getByText("Sheet", { exact: true })).toBeVisible();
});

test("the composer header exposes export and a save indicator, like the sprite editor", async () => {
  const sheet = await createSpritesheet({ name: "Composed" });
  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  // Export is a button in both headers, never buried in a menu. The status dot is named by
  // its state; dnd-kit's own live region is also role="status", hence the explicit name.
  await expect.element(screen.getByRole("button", { name: "Export" })).toBeVisible();
  await expect.element(screen.getByRole("status", { name: "Saved" })).toBeVisible();

  await userEvent.fill(screen.getByLabelText("Spritesheet name"), "Renamed");
  await userEvent.keyboard("{Enter}");

  // The badge reports a real write, so the rename must land in the database behind it.
  await expect.poll(async () => (await getSpritesheet(sheet.id)).name).toBe("Renamed");
  await expect.element(screen.getByRole("status", { name: "Saved" })).toBeVisible();
});

test("the composer's palette lists project sprites to drag onto the canvas", async () => {
  await createSprite({ name: "Hero", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });

  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  await expect.element(screen.getByText("Hero")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Export" })).toBeVisible();
});

test("a sprite already on the sheet drops out of the palette until it is removed", async () => {
  const placed = await createSprite({ name: "Hero", width: 8, height: 8 });
  await createSprite({ name: "Villain", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });
  await updateSpritesheet(sheet.id, {
    blocks: [{ id: "block-1", spriteId: placed.id, row: 0 }],
  });

  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  // A sheet packs each sprite once, so only the unplaced one is still offered.
  await expect
    .element(screen.getByRole("button", { name: "Drag Villain onto the sheet" }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: "Drag Hero onto the sheet" }))
    .not.toBeInTheDocument();

  // An 8×8 sprite is a 32px block at 4× — too small to draw its ✕, which stays keyboard-reachable.
  // A block renders before its sprite's name has loaded, so wait for the labelled button.
  const removeHero = screen.getByRole("button", { name: "Remove Hero", exact: true });
  await expect.element(removeHero).toBeInTheDocument();
  (removeHero.element() as HTMLElement).focus();
  await userEvent.keyboard("{Enter}");

  // Removing it from the canvas returns it to the palette.
  await expect
    .element(screen.getByRole("button", { name: "Drag Hero onto the sheet" }))
    .toBeVisible();
  await builderSaveSettled();
});

test("a persisted block renders on the canvas and can be removed", async () => {
  const sprite = await createSprite({ name: "Hero", width: 16, height: 16 });
  const sheet = await createSpritesheet({ name: "Composed" });
  await updateSpritesheet(sheet.id, {
    blocks: [{ id: "block-1", spriteId: sprite.id, row: 0 }],
  });

  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  // Exact, because dnd-kit gives the draggable wrapper its own role="button" whose computed
  // name concatenates the nested remove button's label with the block's visible name.
  const removeButton = screen.getByRole("button", { name: "Remove Hero", exact: true });
  await expect.element(removeButton).toBeInTheDocument();

  // 16×16 at 4× is a 64px block, big enough to draw its ✕ — clicked with the pointer, on hover.
  await userEvent.hover(document.querySelector("[data-block-id]")!);
  await userEvent.click(removeButton);
  await expect.element(removeButton).not.toBeInTheDocument();
  await builderSaveSettled();
});

test("Export downloads the composed sheet as a PNG in one click", async () => {
  const sprite = await createSprite({ name: "Hero", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });
  await updateSpritesheet(sheet.id, {
    blocks: [{ id: "block-1", spriteId: sprite.id, row: 0 }],
  });

  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  // One click, no dialog.
  await userEvent.click(screen.getByRole("button", { name: "Export" }));

  await expect.poll(() => createObjectURL.mock.calls.length).toBe(1);
  const [blob] = createObjectURL.mock.calls[0] as [Blob];
  expect(blob.type).toBe("image/png");
  expect(blob.size).toBeGreaterThan(0);

  createObjectURL.mockRestore();
});

test("the composer header keeps Export reachable in a narrow window", async () => {
  await page.viewport(640, 720);
  const sheet = await createSpritesheet({ name: "A spritesheet with a rather long name indeed" });
  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  const exportButton = screen.getByRole("button", { name: "Export" });
  await expect.element(exportButton).toBeVisible();
  // Visible *and* inside the viewport — the old header pushed it past the edge, where it was
  // clipped rather than hidden, so a visibility check alone would not have caught it.
  const rect = exportButton.element().getBoundingClientRect();
  expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
  await expect.element(screen.getByRole("button", { name: "Zoom in" })).toBeVisible();
});

test("zoom steps change the readout and the size every block renders at", async () => {
  const sprite = await createSprite({ name: "Hero", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });
  await updateSpritesheet(sheet.id, { blocks: [{ id: "block-1", spriteId: sprite.id, row: 0 }] });
  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  const block = () => document.querySelector('[data-block-id="block-1"]');
  await expect.poll(block).toBeTruthy();
  await expect.element(screen.getByLabelText("Zoom level")).toHaveTextContent("4×");
  expect(block()!.getBoundingClientRect().width).toBe(32);

  await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));

  await expect.element(screen.getByLabelText("Zoom level")).toHaveTextContent("6×");
  expect(block()!.getBoundingClientRect().width).toBe(48);
  // The status bar carries the same level as a percentage, like the sprite editor's.
  await expect.element(screen.getByText("600%")).toBeVisible();
});

test("the grid is on when a sheet is first opened", async () => {
  const sheet = await createSpritesheet({ name: "Composed" });
  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  await expect.element(screen.getByTestId("builder-grid")).toBeInTheDocument();
  await expect
    .element(screen.getByRole("button", { name: "Grid options" }))
    .toHaveAttribute("aria-pressed", "true");
});

test("on a block too small to show it, the remove button appears in the corner when focused", async () => {
  const sprite = await createSprite({ name: "Hero", width: 8, height: 8 });
  const other = await createSprite({ name: "Villain", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });
  await updateSpritesheet(sheet.id, {
    blocks: [
      { id: "a", spriteId: sprite.id, row: 0 },
      { id: "b", spriteId: other.id, row: 1 },
    ],
  });
  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });
  const remove = screen.getByRole("button", { name: "Remove Hero", exact: true });
  await expect.element(remove).toBeInTheDocument();

  const button = remove.element() as HTMLElement;
  expect(getComputedStyle(button).opacity).toBe("0");

  await userEvent.keyboard("{Tab}"); // move keyboard modality on, then focus the button directly
  button.focus();

  // Inside its own block's box, not pushed below it into the next row.
  const blockRect = document.querySelector('[data-block-id="a"]')!.getBoundingClientRect();
  const rect = button.getBoundingClientRect();
  expect(rect.top).toBeGreaterThanOrEqual(blockRect.top);
  expect(rect.bottom).toBeLessThanOrEqual(blockRect.bottom);
  await expect.poll(() => getComputedStyle(button).opacity).toBe("1");
});
