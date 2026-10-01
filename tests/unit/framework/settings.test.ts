import { FlipHorizontal } from "lucide-react";
import { describe, expect, it } from "vitest";
import { BRUSH_SIZES } from "@/constants/tools";
import { choice, nextChoice, resolveSettings, switchSetting, toggle } from "@/framework/settings";

const SETTINGS = {
  size: choice({ label: "Brush size", values: BRUSH_SIZES, default: 1 }),
  mirror: toggle({ label: "Mirror", icon: FlipHorizontal, default: false }),
  merged: switchSetting({ label: "Sample merged image", default: true }),
};

describe("resolveSettings", () => {
  it("gives every declared setting its default when nothing is stored", () => {
    expect(resolveSettings(SETTINGS, undefined)).toEqual({ size: 1, mirror: false, merged: true });
  });

  it("prefers stored values, and ignores keys the declaration does not have", () => {
    expect(resolveSettings(SETTINGS, { size: 4, merged: false, stray: 9 })).toEqual({
      size: 4,
      mirror: false,
      merged: false,
    });
  });

  it("resolves no settings to an empty object", () => {
    expect(resolveSettings(undefined, { size: 4 })).toEqual({});
  });
});

describe("setting helpers", () => {
  it("tag each setting with its kind", () => {
    expect([SETTINGS.size.kind, SETTINGS.mirror.kind, SETTINGS.merged.kind]).toEqual([
      "choice",
      "toggle",
      "switch",
    ]);
  });
});

describe("nextChoice", () => {
  it("steps 1→2→3→4→6→8 and wraps back to 1", () => {
    const steps: number[] = [];
    let value = 1;
    for (let i = 0; i < BRUSH_SIZES.length; i++) {
      value = nextChoice(SETTINGS.size, value);
      steps.push(value);
    }
    expect(steps).toEqual([2, 3, 4, 6, 8, 1]);
  });

  it("goes to the next value above one that is not in the list", () => {
    expect(nextChoice(SETTINGS.size, 5)).toBe(6);
  });
});
