import { expect, test } from "vitest";
import { ToolOptionsBar } from "@/components/editor/ToolOptionsBar";
import { useEditorStore } from "@/stores/useEditorStore";
import { render } from "@test/render";

test("the bucket tool has no options — tolerance was dropped, not hidden", async () => {
  useEditorStore.getState().setTool("bucket");
  const screen = render(<ToolOptionsBar />);

  await expect.element(screen.getByText("Paint bucket")).toBeVisible();
  expect(screen.getByText(/tolerance/i).elements()).toHaveLength(0);
  expect(screen.getByRole("slider").elements()).toHaveLength(0);
});

test("fill similar also has no options", async () => {
  useEditorStore.getState().setTool("fillSimilar");
  const screen = render(<ToolOptionsBar />);

  await expect.element(screen.getByText("Fill similar")).toBeVisible();
  expect(screen.getByText(/tolerance/i).elements()).toHaveLength(0);
});

test("the picker tool offers only the sample-merged switch", async () => {
  useEditorStore.getState().setTool("picker");
  const screen = render(<ToolOptionsBar />);

  await expect.element(screen.getByText("Sample merged image")).toBeVisible();
});

test("the pencil tool keeps brush size and its own mirror option", async () => {
  useEditorStore.getState().setTool("pencil");
  const screen = render(<ToolOptionsBar />);

  await expect.element(screen.getByRole("group", { name: "Brush size" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Mirror horizontally" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Mirror vertically" })).toBeVisible();
});
