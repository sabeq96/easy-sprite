import { describe, expect, it } from "vitest";
import { TOOL_LIST, TOOLS } from "@/tools";

const TOOL_IDS = TOOL_LIST.map((tool) => tool.id);

const EXPECTED: Record<string, readonly string[]> = {
  pencil: ["size", "mirrorHorizontal", "mirrorVertical"],
  eraser: ["size"],
  bucket: [],
  fillSimilar: [],
  picker: ["pickFromComposite"],
  select: [],
};

const declared = (id: (typeof TOOL_IDS)[number]) => Object.keys(TOOLS[id].settings ?? {});

describe("tool setting declarations", () => {
  it("every tool declares exactly the settings it reads", () => {
    expect(Object.fromEntries(TOOL_IDS.map((id) => [id, declared(id)]))).toEqual(EXPECTED);
  });

  it("only the pencil mirrors, so only it shows mirror controls or a mirrored preview", () => {
    const mirroring = TOOL_IDS.filter((id) => declared(id).some((key) => key.startsWith("mirror")));
    expect(mirroring).toEqual(["pencil"]);
  });

  it("the pencil and eraser each step their own brush size when their key is pressed again", () => {
    expect(TOOL_IDS.filter((id) => TOOLS[id].reselect)).toEqual(["pencil", "eraser"]);
    expect(TOOLS.pencil.reselect).toBe("size");
    expect(TOOLS.eraser.reselect).toBe("size");
  });

  it("mirror horizontally carries the V command; mirror vertically has none", () => {
    const { mirrorHorizontal, mirrorVertical } = TOOLS.pencil.settings ?? {};
    expect(mirrorHorizontal).toMatchObject({
      kind: "toggle",
      group: "Mirror",
      command: { id: "tool.toggleMirror", keys: [{ key: "v" }] },
    });
    expect(mirrorVertical).toMatchObject({ kind: "toggle", group: "Mirror" });
    expect(mirrorVertical && "command" in mirrorVertical).toBeFalsy();
  });
});
