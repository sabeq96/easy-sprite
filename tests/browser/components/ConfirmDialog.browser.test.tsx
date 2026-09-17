import { expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { render } from "@test/render";

test("cancel closes the dialog without confirming", async () => {
  const onConfirm = vi.fn();
  const screen = render(
    <ConfirmDialog title="Delete sprite?" description="This cannot be undone." onConfirm={onConfirm}>
      <Button>Delete</Button>
    </ConfirmDialog>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  await expect.element(screen.getByRole("alertdialog")).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onConfirm).not.toHaveBeenCalled();
});

test("confirming runs onConfirm with the given label", async () => {
  const onConfirm = vi.fn();
  const screen = render(
    <ConfirmDialog
      title="Delete sprite?"
      description="This cannot be undone."
      confirmLabel="Delete forever"
      destructive
      onConfirm={onConfirm}
    >
      <Button>Delete</Button>
    </ConfirmDialog>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  await userEvent.click(screen.getByRole("button", { name: "Delete forever" }));

  expect(onConfirm).toHaveBeenCalledTimes(1);
});
