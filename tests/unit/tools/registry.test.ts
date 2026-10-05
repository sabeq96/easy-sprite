import { describe, expect, it } from "vitest";
import { TOOL_LIST } from "@/tools";

const TOOL_IDS = TOOL_LIST.map((tool) => tool.id);

describe("tool registry", () => {
  it("lists the tools in sidebar order", () => {
    expect(TOOL_IDS).toEqual(["pencil", "eraser", "shape", "bucket", "fillSimilar", "picker", "select"]);
  });

  it("gives every tool a unique id", () => {
    expect(new Set(TOOL_IDS).size).toBe(TOOL_IDS.length);
  });

  it("gives every tool an icon", () => {
    for (const tool of TOOL_LIST) expect(tool.icon, tool.id).toBeTruthy();
  });
});
