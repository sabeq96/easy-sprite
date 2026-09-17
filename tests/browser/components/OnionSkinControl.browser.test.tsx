import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { OnionSkinControl } from "@/components/editor/OnionSkinControl";
import { useEditorStore } from "@/stores/useEditorStore";
import { render } from "@test/render";

test("the trigger has a hover tooltip naming the control", async () => {
  const screen = render(<OnionSkinControl />);
  const trigger = screen.getByRole("button", { name: "Onion skin settings" });

  await userEvent.hover(trigger);
  await expect.element(screen.getByText("Onion skin settings")).toBeVisible();
});

test("only a before/after switch decides direction — no frame-count fields", async () => {
  const screen = render(<OnionSkinControl />);

  await userEvent.click(screen.getByRole("button", { name: "Onion skin settings" }));

  await expect.element(screen.getByRole("switch", { name: "Onion skin direction" })).toBeVisible();
  expect(screen.getByText(/Frames before/i).elements()).toHaveLength(0);
  expect(screen.getByText(/Frames after/i).elements()).toHaveLength(0);
});

test("toggling the direction switch flips onion.direction between before and after", async () => {
  const screen = render(<OnionSkinControl />);
  await userEvent.click(screen.getByRole("button", { name: "Onion skin settings" }));

  expect(useEditorStore.getState().onion.direction).toBe("before");

  const direction = screen.getByRole("switch", { name: "Onion skin direction" });
  await userEvent.click(direction);
  expect(useEditorStore.getState().onion.direction).toBe("after");

  await userEvent.click(direction);
  expect(useEditorStore.getState().onion.direction).toBe("before");
});
