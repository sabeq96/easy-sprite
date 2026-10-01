import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { openEditor } from "@test/editor";

// Playwright's mouse outlives a test. If one test ends over a button and the next mounts the editor
// beneath the parked pointer, that button's tooltip opens and covers whatever sits below it.
test("a test can leave the pointer resting on a top-bar button", async () => {
  const editor = await openEditor();
  await userEvent.hover(editor.screen.getByRole("button", { name: "Back to sprites" }));
  await expect.element(editor.screen.getByText(/^Back to sprites/)).toBeVisible();
});

test("the next test can still click what that button's tooltip would cover", async () => {
  const editor = await openEditor();
  const toggle = editor.screen.getByRole("button", { name: "1 pixels", exact: true });

  await userEvent.click(toggle, { timeout: 2000 });

  await expect.element(toggle).toHaveAttribute("aria-pressed", "true");
});
