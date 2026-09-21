import { describe, expect, it } from "vitest";
import { hexToRgba } from "@/lib/color";
import { createTestStore } from "@test/store";

describe("colorSlice", () => {
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
