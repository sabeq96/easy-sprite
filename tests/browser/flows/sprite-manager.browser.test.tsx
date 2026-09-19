import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { AppRoutes } from "@/app/routes";
import { render } from "@test/render";

test("creating a sprite from the library opens it in the editor, and it lists on the way back", async () => {
  const screen = render(<AppRoutes />, { route: "/sprites" });

  // The empty state and the toolbar both offer a "New sprite" button. Exact, because the
  // toolbar also has a "New spritesheet" button whose name contains "New sprite" as a substring.
  await userEvent.click(screen.getByRole("button", { name: "New sprite", exact: true }).first());
  await expect.element(screen.getByRole("dialog", { name: "New sprite" })).toBeVisible();

  await userEvent.fill(screen.getByLabelText("Name"), "Hero walk");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  await expect.element(screen.getByRole("application", { name: "Sprite canvas" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Back to sprites" }));
  await expect.element(screen.getByRole("button", { name: "Open Hero walk" })).toBeVisible();
});

test("deleting a sprite through its menu removes it from the library", async () => {
  const screen = render(<AppRoutes />, { route: "/sprites" });

  await userEvent.click(screen.getByRole("button", { name: "New sprite", exact: true }).first());
  await userEvent.fill(screen.getByLabelText("Name"), "Throwaway");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));
  await expect.element(screen.getByRole("application", { name: "Sprite canvas" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Back to sprites" }));
  await expect.element(screen.getByRole("button", { name: "Open Throwaway" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Actions for Throwaway" }));
  // The delete row is an AlertDialogTrigger wrapping the menu item (so the confirm can nest
  // inside it), which gives it role="button" rather than the menu's own "menuitem" role.
  await userEvent.click(screen.getByRole("button", { name: "Delete", exact: true }).first());
  await userEvent.click(screen.getByRole("button", { name: "Delete", exact: true }).last());

  await expect.element(screen.getByRole("button", { name: "Open Throwaway" })).not.toBeInTheDocument();
});
