import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { createPalette, findPalette } from "@/db/repositories/palettes";
import { db } from "@/db/db";
import { useEditorStore } from "@/stores/useEditorStore";
import { activeColors, openEditor, pixelAt, type Editor } from "@test/editor";
import { settled } from "@test/dom";
import { holdDrag, releaseDrag } from "@test/pointer";

const RED = { r: 255, g: 0, b: 0, a: 255 };

/** Opens the editor with an active palette of the given colours. */
async function withPalette(colors: string[]) {
  const palette = await createPalette("Test palette", colors);
  const editor = await openEditor();
  useEditorStore.getState().setActivePalette(palette.id);
  await expect.poll(() => paletteSwatches().length).toBe(colors.length);
  return { editor, paletteId: palette.id };
}

/** The editable palette grid's swatches, in order. */
const paletteSwatches = () =>
  [...document.querySelectorAll('[data-drag-item="sortable"]')].filter((node) =>
    node.closest("[aria-label='Colors']"),
  );
const paletteHexes = () =>
  paletteSwatches().map((node) =>
    node.querySelector("[aria-label^='Color #']")?.getAttribute("aria-label")?.slice(6, 13),
  );

/**
 * A swatch button by colour, in the palette grid (the first match — before "Used in sprite"). By
 * its own label: its draggable wrapper is also role="button" and takes its name from the swatch.
 */
const swatch = (editor: Editor, hex: string) =>
  editor.screen.getByLabelText(`Color ${hex}ff`, { exact: true }).first();

test("clicking a swatch picks it as primary, right-clicking as secondary", async () => {
  const { editor } = await withPalette(["#ff0000", "#00ff00", "#0000ff"]);

  await userEvent.click(swatch(editor, "#00ff00"));
  await userEvent.click(swatch(editor, "#0000ff"), { button: "right" });

  expect(activeColors()).toEqual({ primary: "#00ff00ff", secondary: "#0000ffff" });
  // The primary colour's swatch is marked as the active one.
  await expect.element(swatch(editor, "#00ff00")).toHaveAttribute("aria-pressed", "true");
  await expect.element(swatch(editor, "#ff0000")).toHaveAttribute("aria-pressed", "false");
});

test("keys 1–9 pick palette slots as primary, and with Shift as secondary", async () => {
  await withPalette(["#ff0000", "#00ff00", "#0000ff"]);

  await userEvent.keyboard("2");
  expect(activeColors().primary).toBe("#00ff00ff");
  await userEvent.keyboard("{Shift>}3{/Shift}");
  expect(activeColors().secondary).toBe("#0000ffff");

  // A slot past the end of the palette does nothing.
  await userEvent.keyboard("9");
  expect(activeColors().primary).toBe("#00ff00ff");
});

test("digits typed into a text field never pick colours", async () => {
  const { editor } = await withPalette(["#ff0000", "#00ff00"]);
  const before = activeColors().primary;

  await userEvent.click(editor.screen.getByRole("textbox", { name: "Sprite name" }));
  await userEvent.keyboard("Level 2");

  expect(activeColors().primary).toBe(before);
});

test("X swaps primary and secondary, and D resets them to black and transparent", async () => {
  await openEditor();
  useEditorStore.getState().setPrimaryColor(RED);
  useEditorStore.getState().setSecondaryColor({ r: 0, g: 0, b: 255, a: 255 });

  await userEvent.keyboard("x");
  expect(activeColors()).toEqual({ primary: "#0000ffff", secondary: "#ff0000ff" });

  await userEvent.keyboard("d");
  expect(activeColors()).toEqual({ primary: "#000000ff", secondary: "#00000000" });
});

test("the swap button does what X does", async () => {
  const editor = await openEditor();
  useEditorStore.getState().setPrimaryColor(RED);

  await userEvent.click(editor.screen.getByRole("button", { name: "Swap colors" }));

  expect(activeColors()).toEqual({ primary: "#00000000", secondary: "#ff0000ff" });
});

test("a colour picked from the palette is the one the pencil paints", async () => {
  const { editor } = await withPalette(["#12ab34"]);

  await userEvent.click(swatch(editor, "#12ab34"));
  editor.click({ x: 2, y: 2 });

  expect(pixelAt(2, 2)).toBe("#12ab34ff");
});

test("colours painted into the sprite are listed under 'Used in sprite' and can be picked", async () => {
  const editor = await openEditor();
  useEditorStore.getState().setPrimaryColor(RED);
  editor.click({ x: 1, y: 1 });
  useEditorStore.getState().setPrimaryColor({ r: 0, g: 0, b: 0, a: 255 });

  const used = swatch(editor, "#ff0000");
  await expect.element(used).toBeVisible();
  await userEvent.click(used);

  expect(activeColors().primary).toBe("#ff0000ff");
});

test("the typed hex in the primary colour's picker sets the colour", async () => {
  const editor = await openEditor();

  await userEvent.click(editor.screen.getByRole("button", { name: "Primary color #000000ff" }));
  const hex = editor.screen.getByRole("textbox", { name: "Hex" });
  await userEvent.clear(hex);
  await userEvent.type(hex, "#ff8800");

  expect(activeColors().primary).toBe("#ff8800ff");
  // The keys typed into the field never reached the shortcut handler ("f" etc. would be no-ops,
  // but "8"… and every letter must stay inside the field).
  expect(useEditorStore.getState().toolId).toBe("pencil");
});

test("double-clicking a palette swatch removes it from the palette", async () => {
  const { editor, paletteId } = await withPalette(["#ff0000", "#00ff00", "#0000ff"]);

  await userEvent.dblClick(swatch(editor, "#00ff00"));

  await expect.poll(async () => (await findPalette(paletteId))?.colors).toEqual(["#ff0000", "#0000ff"]);
  await expect.poll(paletteHexes).toEqual(["#ff0000", "#0000ff"]);
});

test("dragging a swatch out of the palette removes it", async () => {
  const { editor, paletteId } = await withPalette(["#ff0000", "#00ff00", "#0000ff"]);
  const source = await settled(() => paletteSwatches()[0]);
  const canvas = editor.canvas.getBoundingClientRect();
  const to = { x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 };

  await holdDrag(source, to);
  await releaseDrag(to);

  await expect.poll(async () => (await findPalette(paletteId))?.colors).toEqual(["#00ff00", "#0000ff"]);
});

test("dragging a 'used in sprite' colour into the palette adds it at the drop slot", async () => {
  const { editor, paletteId } = await withPalette(["#ff0000", "#00ff00"]);
  useEditorStore.getState().setPrimaryColor({ r: 0x12, g: 0x34, b: 0x56, a: 255 });
  editor.click({ x: 1, y: 1 });

  const used = await settled(() =>
    document.querySelector("[aria-label='Colors'] [aria-label='Color #123456ff']")?.closest("[data-drag-item]"),
  );
  const first = (await settled(() => paletteSwatches()[0])).getBoundingClientRect();
  const to = { x: first.left + first.width / 2, y: first.top + first.height / 2 };

  await holdDrag(used, to);
  await releaseDrag(to);

  await expect
    .poll(async () => (await findPalette(paletteId))?.colors)
    .toEqual(["#123456", "#ff0000", "#00ff00"]);
});

test("'Add colors from sprite' appends every painted colour the palette lacks", async () => {
  const { editor, paletteId } = await withPalette(["#ff0000"]);
  editor.click({ x: 0, y: 0 }); // black
  useEditorStore.getState().setPrimaryColor(RED);
  editor.click({ x: 1, y: 0 }); // red, already in the palette

  await userEvent.click(editor.screen.getByRole("button", { name: "Palette actions" }));
  await userEvent.click(editor.screen.getByRole("menuitem", { name: "Add colors from sprite" }));

  await expect.poll(async () => (await findPalette(paletteId))?.colors).toEqual(["#ff0000", "#000000"]);
});

test("a new palette from the menu is created empty and becomes the active one", async () => {
  const { editor } = await withPalette(["#ff0000"]);

  await userEvent.click(editor.screen.getByRole("button", { name: "Palette actions" }));
  await userEvent.click(editor.screen.getByRole("menuitem", { name: "New palette" }));
  const dialog = editor.screen.getByRole("dialog");
  await userEvent.type(dialog.getByRole("textbox").first(), "Forest");
  await userEvent.click(dialog.getByRole("button", { name: "Create" }));

  await expect.poll(async () => (await db.palettes.toArray()).map((palette) => palette.name).sort()).toEqual([
    "Forest",
    "Test palette",
  ]);
  const forest = (await db.palettes.toArray()).find((palette) => palette.name === "Forest")!;
  await expect.poll(() => useEditorStore.getState().activePaletteId).toBe(forest.id);
  await expect.element(editor.screen.getByText("Drag colors here to add them.")).toBeVisible();
});

test("the palette picker switches between palettes", async () => {
  const warm = await createPalette("Warm", ["#ff0000", "#ff8800"]);
  await createPalette("Cool", ["#0000ff"]);
  const editor = await openEditor();
  useEditorStore.getState().setActivePalette(warm.id);
  await expect.poll(paletteHexes).toEqual(["#ff0000", "#ff8800"]);

  await userEvent.click(editor.screen.getByRole("combobox", { name: "Active palette" }));
  await userEvent.click(editor.screen.getByRole("option", { name: "Cool" }));

  await expect.poll(paletteHexes).toEqual(["#0000ff"]);
  // …and the number keys follow the palette on screen.
  await userEvent.keyboard("1");
  expect(activeColors().primary).toBe("#0000ffff");
});
