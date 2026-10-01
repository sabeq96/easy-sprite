import path from "node:path";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "./src"),
  "@test": path.resolve(import.meta.dirname, "./tests/support"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/components/ui/**", "src/**/*.d.ts"],
      // A floor, not a target — ratchet up as coverage grows rather than chasing 100%, which
      // would just reward padding trivial getters. See docs/phases/phase-13-test-coverage.md §13.6.
      thresholds: { lines: 70, branches: 60 },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./tests/support/setup.unit.ts"],
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
        resolve: { alias },
        test: {
          name: "browser",
          globals: true,
          setupFiles: ["./tests/support/setup.browser.ts"],
          include: ["tests/browser/**/*.browser.test.tsx"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
