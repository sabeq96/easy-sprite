import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { Route, Routes } from "react-router";
import { RouteErrorBoundary } from "@/app/RouteErrorBoundary";
import { render } from "@test/render";

function Crashing(): never {
  throw new Error("Boom");
}

test("a page that throws while rendering shows the crash view, and navigating away recovers", async () => {
  const screen = await render(
    <Routes>
      <Route element={<RouteErrorBoundary />}>
        <Route path="broken" element={<Crashing />} />
        <Route path="sprites" element={<p>Library</p>} />
      </Route>
    </Routes>,
    { route: "/broken" },
  );

  await expect.element(screen.getByRole("alert")).toMatchTextContent("Something went wrong");
  await expect.element(screen.getByText(/Boom/)).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Back to sprites" }));
  await expect.element(screen.getByText("Library")).toBeVisible();
});
