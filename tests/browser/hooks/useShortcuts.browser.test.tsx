import { expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import type { CommandRegistry } from "@/commands/types";
import { useShortcuts } from "@/hooks/useShortcuts";
import { IS_APPLE } from "@/lib/keys";
import { render } from "@test/render";

/** `Ctrl+Z` (or `⌘Z` on a Mac runner) via testing-library's `{Modifier>}key{/Modifier}` syntax. */
const UNDO_CHORD = IS_APPLE ? "{Meta>}z{/Meta}" : "{Control>}z{/Control}";

function Harness({ commands }: { commands: CommandRegistry }) {
  useShortcuts(commands);
  return (
    <div>
      <input aria-label="Sprite name" defaultValue="Hero" />
      <div contentEditable aria-label="Notes" />
    </div>
  );
}

function undoRegistry(run: () => void): CommandRegistry {
  return { "edit.undo": { id: "edit.undo", label: "Undo", group: "Edit", run } };
}

test("a bound key fires its command", async () => {
  const undo = vi.fn();
  const screen = render(<Harness commands={undoRegistry(undo)} />);
  await expect.element(screen.getByLabelText("Sprite name")).toBeVisible();

  await userEvent.keyboard(UNDO_CHORD);
  expect(undo).toHaveBeenCalledTimes(1);
});

test("typing in a text input does not trigger the shortcut", async () => {
  const undo = vi.fn();
  const screen = render(<Harness commands={undoRegistry(undo)} />);
  const input = screen.getByLabelText("Sprite name");
  await userEvent.click(input);

  await userEvent.keyboard(UNDO_CHORD);
  expect(undo).not.toHaveBeenCalled();
});

test("typing in a contenteditable region does not trigger the shortcut", async () => {
  const undo = vi.fn();
  const screen = render(<Harness commands={undoRegistry(undo)} />);
  const notes = screen.getByLabelText("Notes");
  await userEvent.click(notes);

  await userEvent.keyboard(UNDO_CHORD);
  expect(undo).not.toHaveBeenCalled();
});

test("a disabled command does not run", async () => {
  const undo = vi.fn();
  const commands: CommandRegistry = {
    "edit.undo": { id: "edit.undo", label: "Undo", group: "Edit", isEnabled: () => false, run: undo },
  };
  const screen = render(<Harness commands={commands} />);
  await expect.element(screen.getByLabelText("Sprite name")).toBeVisible();

  await userEvent.keyboard(UNDO_CHORD);
  expect(undo).not.toHaveBeenCalled();
});
