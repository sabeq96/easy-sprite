import { describe, expect, it } from "vitest";
import { onionOffset } from "@/constants/animation";

describe("onionOffset", () => {
  it("points at the immediate previous frame for 'before'", () => {
    expect(onionOffset("before")).toBe(-1);
  });

  it("points at the immediate next frame for 'after'", () => {
    expect(onionOffset("after")).toBe(1);
  });
});
