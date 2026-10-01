import { beforeEach, describe, expect, it } from "vitest";
import { usePaletteStore } from "@/editor/palette/store";
import { hexToRgba } from "@/lib/color";
import { resetEditorStores } from "@test/store";

beforeEach(() => resetEditorStores());

describe("palette store", () => {
  it("swapColors exchanges primary and secondary", () => {
    const primary = hexToRgba("#ff0000");
    const secondary = hexToRgba("#0000ff");
    usePaletteStore.getState().setPrimaryColor(primary);
    usePaletteStore.getState().setSecondaryColor(secondary);

    usePaletteStore.getState().swapColors();
    expect(usePaletteStore.getState().primaryColor).toEqual(secondary);
    expect(usePaletteStore.getState().secondaryColor).toEqual(primary);
  });

  it("resetColors restores black-on-transparent", () => {
    usePaletteStore.getState().setPrimaryColor(hexToRgba("#ff0000"));
    usePaletteStore.getState().resetColors();
    expect(usePaletteStore.getState().primaryColor).toEqual({ r: 0, g: 0, b: 0, a: 255 });
    expect(usePaletteStore.getState().secondaryColor).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });
});
