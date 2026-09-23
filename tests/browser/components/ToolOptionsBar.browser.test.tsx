import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { ToolOptionsBar } from "@/components/editor/ToolOptionsBar";
import { CommandsProvider } from "@/commands/CommandsContext";
import { createToolCommands } from "@/commands/toolCommands";
import { ToolSidebar } from "@/components/editor/ToolSidebar";
import { TOOL_IDS, TOOLS } from "@/editor/tools";
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

test.each(TOOL_IDS)("the %s bar shows exactly the options that tool declares", async (toolId) => {
  useEditorStore.getState().setTool(toolId);
  const screen = render(<ToolOptionsBar />);
  const declared = TOOLS[toolId].options;

  // Each control appears only when the tool itself claims to honour it — the guard against a
  // control drifting onto a tool that ignores it, which is how the inert Mirror toggle happened.
  const brushSize = screen.getByRole("group", { name: "Brush size" }).elements().length;
  const mirror = screen.getByRole("button", { name: "Mirror horizontally" }).elements().length;
  const pickSource = screen.getByText("Sample merged image").elements().length;

  expect(brushSize).toBe(declared.includes("brushSize") ? 1 : 0);
  expect(mirror).toBe(declared.includes("mirror") ? 1 : 0);
  expect(pickSource).toBe(declared.includes("pickSource") ? 1 : 0);
});

test("picking another tool turns mirroring off, so it can't linger unapplied", async () => {
  useEditorStore.getState().setTool("pencil");
  const screen = render(
    <CommandsProvider value={createToolCommands(useEditorStore)}>
      <ToolSidebar />
      <ToolOptionsBar />
    </CommandsProvider>,
  );

  const mirror = screen.getByRole("button", { name: "Mirror horizontally" });
  await userEvent.click(mirror);
  await expect.element(mirror).toHaveAttribute("aria-pressed", "true");

  // The eraser draws the same brush preview but never mirrors, so the option must not survive.
  await userEvent.click(screen.getByRole("button", { name: "Eraser", exact: true }).first());
  expect(useEditorStore.getState().toolOptions.mirrorHorizontal).toBe(false);

  await userEvent.click(screen.getByRole("button", { name: "Pencil", exact: true }).first());
  await expect
    .element(screen.getByRole("button", { name: "Mirror horizontally" }))
    .toHaveAttribute("aria-pressed", "false");
});
