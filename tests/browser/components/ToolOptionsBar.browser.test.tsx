import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { CommandsProvider, type CommandsValue } from "@/commands/CommandsContext";
import { bindCommands } from "@/editor/module";
import { subscribeToModules } from "@/editor/modules";
import { ToolOptionsBar, ToolSidebar, useToolboxStore } from "@/editor/toolbox/api";
import { TOOLBOX_COMMANDS } from "@/editor/toolbox/commands";
import { TOOL_LIST, TOOLS } from "@/tools";
import { moduleContext } from "@test/modules";
import { render } from "@test/render";

/** The bar's command buttons (the mirror toggle) read the registry, as they do in the editor. */
function commands(): CommandsValue {
  return {
    registry: bindCommands(TOOLBOX_COMMANDS, moduleContext()),
    subscribe: subscribeToModules,
  };
}

function renderBar() {
  return render(
    <CommandsProvider value={commands()}>
      <ToolOptionsBar />
    </CommandsProvider>,
  );
}

test("the bucket tool has no options — tolerance was dropped, not hidden", async () => {
  useToolboxStore.getState().setTool("bucket");
  const screen = await renderBar();

  await expect.element(screen.getByText("Paint bucket")).toBeVisible();
  expect(screen.getByText(/tolerance/i).elements()).toHaveLength(0);
  expect(screen.getByRole("slider").elements()).toHaveLength(0);
});

test("fill similar also has no options", async () => {
  useToolboxStore.getState().setTool("fillSimilar");
  const screen = await renderBar();

  await expect.element(screen.getByText("Fill similar")).toBeVisible();
  expect(screen.getByText(/tolerance/i).elements()).toHaveLength(0);
});

test("the picker tool offers only the sample-merged switch", async () => {
  useToolboxStore.getState().setTool("picker");
  const screen = await renderBar();

  await expect.element(screen.getByText("Sample merged image")).toBeVisible();
});

test("the pencil tool keeps brush size and its own mirror option", async () => {
  useToolboxStore.getState().setTool("pencil");
  const screen = await renderBar();

  await expect.element(screen.getByText("Brush size", { exact: true })).toBeVisible();
  await expect.element(screen.getByRole("group", { name: "Brush size" })).toBeVisible();
  await expect.element(screen.getByText("Mirror", { exact: true })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Mirror horizontally" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Mirror vertically" })).toBeVisible();
});

test.each(TOOL_LIST.map((tool) => tool.id))("the %s bar shows exactly the settings that tool declares", async (toolId) => {
  useToolboxStore.getState().setTool(toolId);
  const screen = await renderBar();
  const declared = Object.keys(TOOLS[toolId].settings ?? {});

  const brushSize = screen.getByRole("group", { name: "Brush size" }).elements().length;
  const mirror = screen.getByRole("button", { name: "Mirror horizontally" }).elements().length;
  const pickSource = screen.getByText("Sample merged image").elements().length;

  expect(brushSize).toBe(declared.includes("size") ? 1 : 0);
  expect(mirror).toBe(declared.includes("mirrorHorizontal") ? 1 : 0);
  expect(pickSource).toBe(declared.includes("pickFromComposite") ? 1 : 0);
});

test("mirror survives pencil → eraser → pencil, and the eraser never shows it", async () => {
  useToolboxStore.getState().setTool("pencil");
  const screen = await render(
    <CommandsProvider value={commands()}>
      <ToolSidebar />
      <ToolOptionsBar />
    </CommandsProvider>,
  );

  const mirror = screen.getByRole("button", { name: "Mirror horizontally" });
  await userEvent.click(mirror);
  await expect.element(mirror).toHaveAttribute("aria-pressed", "true");

  await userEvent.click(screen.getByRole("button", { name: "Eraser", exact: true }).first());
  await expect.element(screen.getByRole("button", { name: "Mirror horizontally" })).not.toBeInTheDocument();
  expect(useToolboxStore.getState().settings.pencil).toEqual({ mirrorHorizontal: true });

  await userEvent.click(screen.getByRole("button", { name: "Pencil", exact: true }).first());
  await expect
    .element(screen.getByRole("button", { name: "Mirror horizontally" }))
    .toHaveAttribute("aria-pressed", "true");
});
