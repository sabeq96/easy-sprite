import { describe, expect, it } from "vitest";
import { formatHint } from "@/commands/hints";
import { formatModifier } from "@/lib/keys";

describe("formatHint", () => {
  it("names pointer gestures", () => {
    expect(formatHint({ action: "Draw", inputs: [{ pointer: "right-drag" }] })).toBe("Right-drag");
  });

  it("joins inputs pressed together with +", () => {
    const hint = { action: "Duplicate", inputs: [{ hold: "mod" }, { pointer: "drag" }] } as const;
    expect(formatHint(hint)).toBe(`${formatModifier("mod")} + Drag`);
  });

  it("passes free text and Space through", () => {
    expect(formatHint({ action: "Pan", inputs: [{ hold: "space" }, { text: "1–9" }] })).toBe(
      "Space + 1–9",
    );
  });
});
