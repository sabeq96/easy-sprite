import { expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { CommandsProvider } from "@/commands/CommandsContext";
import type { CommandRegistry } from "@/commands/types";
import { SESSION_COMMANDS } from "@/commands/session";
import { CommandButton } from "@/components/common/CommandButton";
import { subscribeToModules } from "@/editor/modules";
import { useToolboxStore } from "@/editor/toolbox/api";
import { useViewStore } from "@/editor/view/api";
import { formatBinding } from "@/lib/keys";
import { render } from "@test/render";

const REDO_KEYS = SESSION_COMMANDS.find(({ id }) => id === "edit.redo")?.keys ?? [];

function renderWith(registry: CommandRegistry, ui: React.ReactNode) {
  return render(
    <CommandsProvider value={{ registry, subscribe: subscribeToModules }}>{ui}</CommandsProvider>,
  );
}

test("the tooltip shows the command's label and every one of its keys", async () => {
  const screen = await renderWith(
    {
      "edit.redo": {
        id: "edit.redo",
        label: "Redo",
        group: "Edit",
        keys: REDO_KEYS,
        run: () => {},
      },
    },
    <CommandButton command="edit.redo">R</CommandButton>,
  );

  await userEvent.hover(screen.getByRole("button", { name: "Redo" }));

  for (const keys of REDO_KEYS.map(formatBinding)) {
    await expect.element(screen.getByText(keys, { exact: true })).toBeVisible();
  }
});

test("aria-pressed follows the command's active state as the store changes", async () => {
  const screen = await renderWith(
    {
      "view.toggleGrid": {
        id: "view.toggleGrid",
        label: "Toggle pixel grid",
        group: "View",
        isActive: () => useViewStore.getState().gridEnabled,
        run: () => useViewStore.getState().toggleGrid(),
      },
    },
    <CommandButton command="view.toggleGrid">G</CommandButton>,
  );
  const button = screen.getByRole("button", { name: "Toggle pixel grid" });
  const initial = useViewStore.getState().gridEnabled;

  await expect.element(button).toHaveAttribute("aria-pressed", String(initial));
  await userEvent.click(button);
  await expect.element(button).toHaveAttribute("aria-pressed", String(!initial));
});

test("pressed and enabled state follow a module store changed from outside the button", async () => {
  const screen = await renderWith(
    {
      "tool.eraser": {
        id: "tool.eraser",
        label: "Eraser",
        group: "Tools",
        isActive: () => useToolboxStore.getState().toolId === "eraser",
        run: () => {},
      },
      "tool.toggleMirror": {
        id: "tool.toggleMirror",
        label: "Mirror horizontally",
        group: "Tools",
        isEnabled: () => useToolboxStore.getState().toolId === "pencil",
        run: () => {},
      },
    },
    <>
      <CommandButton command="tool.eraser">E</CommandButton>
      <CommandButton command="tool.toggleMirror">V</CommandButton>
    </>,
  );
  const eraser = screen.getByRole("button", { name: "Eraser" });
  const mirror = screen.getByRole("button", { name: "Mirror horizontally" });
  await expect.element(eraser).toHaveAttribute("aria-pressed", "false");
  await expect.element(mirror).toBeEnabled();

  useToolboxStore.getState().setTool("eraser");

  await expect.element(eraser).toHaveAttribute("aria-pressed", "true");
  await expect.element(mirror).toBeDisabled();
});

test("a disabled command disables the button", async () => {
  const screen = await renderWith(
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
  const screen = await renderWith(
    { "frame.duplicate": { id: "frame.duplicate", label: "Duplicate frame", group: "Frames", run } },
    <CommandButton command="frame.duplicate" onClick={onClick}>D</CommandButton>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Duplicate frame" }));

  expect(onClick).toHaveBeenCalledOnce();
  expect(run).not.toHaveBeenCalled();
});
