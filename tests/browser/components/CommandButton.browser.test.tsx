import { expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { CommandsProvider } from "@/commands/CommandsContext";
import { commandKeys } from "@/commands/keymap";
import type { CommandRegistry } from "@/commands/types";
import { CommandButton } from "@/components/common/CommandButton";
import { useEditorStore } from "@/stores/useEditorStore";
import { render } from "@test/render";

function renderWith(registry: CommandRegistry, ui: React.ReactNode) {
  return render(<CommandsProvider value={registry}>{ui}</CommandsProvider>);
}

test("the tooltip shows the command's label and every one of its keys", async () => {
  const screen = renderWith(
    { "edit.redo": { id: "edit.redo", label: "Redo", group: "Edit", run: () => {} } },
    <CommandButton command="edit.redo">R</CommandButton>,
  );

  await userEvent.hover(screen.getByRole("button", { name: "Redo" }));

  for (const keys of commandKeys("edit.redo")) {
    await expect.element(screen.getByText(keys, { exact: true })).toBeVisible();
  }
});

test("aria-pressed follows the command's active state as the store changes", async () => {
  const screen = renderWith(
    {
      "view.toggleGrid": {
        id: "view.toggleGrid",
        label: "Toggle pixel grid",
        group: "View",
        isActive: () => useEditorStore.getState().gridEnabled,
        run: () => useEditorStore.getState().toggleGrid(),
      },
    },
    <CommandButton command="view.toggleGrid">G</CommandButton>,
  );
  const button = screen.getByRole("button", { name: "Toggle pixel grid" });
  const initial = useEditorStore.getState().gridEnabled;

  await expect.element(button).toHaveAttribute("aria-pressed", String(initial));
  await userEvent.click(button);
  await expect.element(button).toHaveAttribute("aria-pressed", String(!initial));
});

test("a disabled command disables the button", async () => {
  const screen = renderWith(
    {
      "edit.copy": { id: "edit.copy", label: "Copy", group: "Edit", isEnabled: () => false, run: () => {} },
    },
    <CommandButton command="edit.copy">C</CommandButton>,
  );

  await expect.element(screen.getByRole("button", { name: "Copy" })).toBeDisabled();
});

test("an onClick override replaces the command's action", async () => {
  const run = vi.fn();
  const onClick = vi.fn();
  const screen = renderWith(
    { "frame.duplicate": { id: "frame.duplicate", label: "Duplicate frame", group: "Frames", run } },
    <CommandButton command="frame.duplicate" onClick={onClick}>D</CommandButton>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Duplicate frame" }));

  expect(onClick).toHaveBeenCalledOnce();
  expect(run).not.toHaveBeenCalled();
});
