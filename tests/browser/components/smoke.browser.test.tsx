import { expect, test } from "vitest";
import { render } from "@test/render";

test("renders a button in a real browser DOM", async () => {
  const screen = render(<button>Hello</button>);
  await expect.element(screen.getByRole("button", { name: "Hello" })).toBeVisible();
});
