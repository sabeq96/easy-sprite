import { describe, expect, it } from "vitest";
import { RECENT_COLORS_MAX } from "@/constants/palettes";
import { hexToRgba } from "@/lib/color";
import { createTestStore } from "@test/store";

describe("colorSlice", () => {
  it("records an opaque primary color in recentColors, most recent first", () => {
    const store = createTestStore();
    store.getState().setPrimaryColor(hexToRgba("#ff0000"));
    store.getState().setPrimaryColor(hexToRgba("#00ff00"));
    expect(store.getState().recentColors.slice(0, 2)).toEqual(["#00ff00ff", "#ff0000ff"]);
  });

  it("de-duplicates a color that is picked again instead of listing it twice", () => {
    const store = createTestStore();
    store.getState().setPrimaryColor(hexToRgba("#ff0000"));
    store.getState().setPrimaryColor(hexToRgba("#00ff00"));
    store.getState().setPrimaryColor(hexToRgba("#ff0000"));
    expect(store.getState().recentColors).toEqual(["#ff0000ff", "#00ff00ff"]);
  });

  it("does not record a fully transparent primary color", () => {
    const store = createTestStore();
    store.getState().setPrimaryColor({ r: 0, g: 0, b: 0, a: 0 });
    expect(store.getState().recentColors).toEqual([]);
  });

  it("caps recentColors at RECENT_COLORS_MAX", () => {
    const store = createTestStore();
    for (let i = 0; i < RECENT_COLORS_MAX + 5; i++) {
      store.getState().setPrimaryColor({ r: i, g: 0, b: 0, a: 255 });
    }
    expect(store.getState().recentColors).toHaveLength(RECENT_COLORS_MAX);
  });

  it("swapColors exchanges primary and secondary", () => {
    const store = createTestStore();
    const primary = hexToRgba("#ff0000");
    const secondary = hexToRgba("#0000ff");
    store.getState().setPrimaryColor(primary);
    store.getState().setSecondaryColor(secondary);

    store.getState().swapColors();
    expect(store.getState().primaryColor).toEqual(secondary);
    expect(store.getState().secondaryColor).toEqual(primary);
  });

  it("resetColors restores black-on-transparent", () => {
    const store = createTestStore();
    store.getState().setPrimaryColor(hexToRgba("#ff0000"));
    store.getState().resetColors();
    expect(store.getState().primaryColor).toEqual({ r: 0, g: 0, b: 0, a: 255 });
    expect(store.getState().secondaryColor).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });
});
