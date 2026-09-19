import { expect, test } from "vitest";
import { Panel } from "@/components/common/Panel";
import { render } from "@test/render";

test("defaults to the primary island treatment", async () => {
  const screen = render(<Panel>Contents</Panel>);

  const panel = screen.getByText("Contents");
  await expect.element(panel).toHaveAttribute("data-variant", "primary");
  await expect.element(panel).toHaveClass(/bg-card/);
});

test("the secondary variant swaps the surface colour without a raised shadow", async () => {
  const screen = render(<Panel variant="secondary">Contents</Panel>);

  const panel = screen.getByText("Contents");
  await expect.element(panel).toHaveAttribute("data-variant", "secondary");
  await expect.element(panel).not.toHaveClass(/shadow-sm/);
});

test("renders as another element so semantic landmarks survive", async () => {
  // The editor's bars are <header>/<footer>/<aside>; the chrome must not cost them their role.
  const screen = render(
    <Panel render={<header aria-label="Editor actions" />}>Contents</Panel>,
  );

  await expect.element(screen.getByRole("banner", { name: "Editor actions" })).toBeVisible();
});

test("layout classes passed in are kept alongside the variant's chrome", async () => {
  const screen = render(<Panel className="flex gap-2 p-4">Contents</Panel>);

  const panel = screen.getByText("Contents");
  await expect.element(panel).toHaveClass(/p-4/);
  await expect.element(panel).toHaveClass(/bg-card/);
});
