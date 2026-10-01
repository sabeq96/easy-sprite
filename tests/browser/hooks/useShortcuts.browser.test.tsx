import { expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { CommandRegistry } from "@/commands/types";
import { SESSION_COMMANDS } from "@/commands/session";
import { useShortcuts } from "@/hooks/useShortcuts";
import { IS_APPLE } from "@/lib/keys";
import { keyDown, keyUp } from "@test/keys";
import { render } from "@test/render";

/** `Ctrl+Z` (or `⌘Z` on a Mac runner) via testing-library's `{Modifier>}key{/Modifier}` syntax. */
const UNDO_CHORD = IS_APPLE ? "{Meta>}z{/Meta}" : "{Control>}z{/Control}";
const UNDO_KEYS = SESSION_COMMANDS.find(({ id }) => id === "edit.undo")?.keys ?? [];

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
  return { "edit.undo": { id: "edit.undo", label: "Undo", group: "Edit", keys: UNDO_KEYS, run } };
}

test("a bound key fires its command", async () => {
  const undo = vi.fn();
  const screen = await render(<Harness commands={undoRegistry(undo)} />);
  await expect.element(screen.getByLabelText("Sprite name")).toBeVisible();

  await userEvent.keyboard(UNDO_CHORD);
  expect(undo).toHaveBeenCalledTimes(1);
});

test("typing in a text input does not trigger the shortcut", async () => {
  const undo = vi.fn();
  const screen = await render(<Harness commands={undoRegistry(undo)} />);
  const input = screen.getByLabelText("Sprite name");
  await userEvent.click(input);

  await userEvent.keyboard(UNDO_CHORD);
  expect(undo).not.toHaveBeenCalled();
});

test("typing in a contenteditable region does not trigger the shortcut", async () => {
  const undo = vi.fn();
  const screen = await render(<Harness commands={undoRegistry(undo)} />);
  const notes = screen.getByLabelText("Notes");
  await userEvent.click(notes);

  await userEvent.keyboard(UNDO_CHORD);
  expect(undo).not.toHaveBeenCalled();
});

test("a disabled command does not run", async () => {
  const undo = vi.fn();
  const commands: CommandRegistry = {
    "edit.undo": {
      id: "edit.undo",
      label: "Undo",
      group: "Edit",
      keys: UNDO_KEYS,
      isEnabled: () => false,
      run: undo,
    },
  };
  const screen = await render(<Harness commands={commands} />);
  await expect.element(screen.getByLabelText("Sprite name")).toBeVisible();

  await userEvent.keyboard(UNDO_CHORD);
  expect(undo).not.toHaveBeenCalled();
});

function holdRegistry() {
  const hold = { press: vi.fn(), release: vi.fn(), cancel: vi.fn() };
  const run = vi.fn();
  const commands: CommandRegistry = {
    "tool.eraser": { id: "tool.eraser", label: "Eraser", group: "Tools", keys: [{ key: "e" }], run, hold },
  };
  return { commands, hold, run };
}

test("a key bound to a hold command reports its press and release instead of running", async () => {
  const { commands, hold, run } = holdRegistry();
  const screen = await render(<Harness commands={commands} />);
  await expect.element(screen.getByLabelText("Sprite name")).toBeVisible();

  const down = keyDown("e", { code: "KeyE", at: 100 });
  keyDown("e", { code: "KeyE", at: 250, repeat: true });
  keyUp("e", { code: "KeyE", at: 400 });

  expect(down.defaultPrevented).toBe(true);
  expect(hold.press).toHaveBeenCalledExactlyOnceWith({ code: "KeyE", at: 100 });
  expect(hold.release).toHaveBeenCalledExactlyOnceWith({ code: "KeyE", at: 400 });
  expect(run).not.toHaveBeenCalled();
});

test("a release is matched by physical key, and a key never pressed releases nothing", async () => {
  const { commands, hold } = holdRegistry();
  const screen = await render(<Harness commands={commands} />);
  await expect.element(screen.getByLabelText("Sprite name")).toBeVisible();

  keyUp("e", { code: "KeyE", at: 50 });
  expect(hold.release).not.toHaveBeenCalled();

  keyDown("e", { code: "KeyE", at: 100 });
  // Option held mid-press changes `key` but not `code`.
  keyUp("´", { code: "KeyE", at: 400 });
  expect(hold.release).toHaveBeenCalledExactlyOnceWith({ code: "KeyE", at: 400 });
});

test("losing window focus, or unmounting, mid-press cancels the hold", async () => {
  const { commands, hold } = holdRegistry();
  const screen = await render(<Harness commands={commands} />);
  await expect.element(screen.getByLabelText("Sprite name")).toBeVisible();

  keyDown("e", { code: "KeyE", at: 0 });
  window.dispatchEvent(new Event("blur"));
  expect(hold.cancel).toHaveBeenCalledTimes(1);

  keyDown("e", { code: "KeyE", at: 1000 });
  await screen.unmount();
  expect(hold.cancel).toHaveBeenCalledTimes(2);
});
