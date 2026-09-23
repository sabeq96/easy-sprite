import { describe, expect, it } from "vitest";
import { TOOL_LIST, TOOLS } from "@/editor/tools";

const TOOL_IDS = TOOL_LIST.map((tool) => tool.id);

/**
 * The declarations the options bar and the brush preview both read. An option listed here but
 * ignored by the tool is exactly the bug that put an inert Mirror toggle on the eraser, so these
 * expectations are spelled out rather than derived from the same source they are checking.
 */
const EXPECTED: Record<string, readonly string[]> = {
  pencil: ["brushSize", "mirror"],
  eraser: ["brushSize"],
  bucket: [],
  fillSimilar: [],
  picker: ["pickSource"],
  select: [],
};

describe("tool option declarations", () => {
  it("every tool declares the options it honours", () => {
    const declared = Object.fromEntries(
      TOOL_IDS.map((id) => [id, [...TOOLS[id].options]]),
    );
    expect(declared).toEqual(EXPECTED);
  });

  it("only the pencil mirrors, so only it may show mirror controls or a mirrored preview", () => {
    const mirroring = TOOL_IDS.filter((id) => TOOLS[id].options.includes("mirror"));
    expect(mirroring).toEqual(["pencil"]);
  });

  it("a tool with no brush footprint never claims a brush size", () => {
    // The brush preview keys off "brushSize"; a one-shot fill has no footprint to preview.
    for (const id of ["bucket", "fillSimilar", "picker", "select"] as const) {
      expect(TOOLS[id].options).not.toContain("brushSize");
    }
  });
});
