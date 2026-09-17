import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { render as renderBrowser } from "vitest-browser-react";
import { AppProviders } from "@/app/providers";

export function render(ui: ReactNode, { route = "/" } = {}) {
  return renderBrowser(
    <MemoryRouter initialEntries={[route]}>
      <AppProviders>{ui}</AppProviders>
    </MemoryRouter>,
  );
}

export { userEvent } from "@vitest/browser/context";
