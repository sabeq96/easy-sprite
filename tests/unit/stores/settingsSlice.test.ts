import { describe, expect, it } from "vitest";
import { createTestStore } from "@test/store";

describe("settingsSlice", () => {
  it("starts empty: every tool reads its declared defaults", () => {
    expect(createTestStore().getState().settings).toEqual({});
  });

  it("stores a value under its tool and key, leaving other tools alone", () => {
    const store = createTestStore();
    store.getState().setSetting("pencil", "size", 4);
    store.getState().setSetting("pencil", "mirrorHorizontal", true);
    store.getState().setSetting("eraser", "size", 2);

    expect(store.getState().settings).toEqual({
      pencil: { size: 4, mirrorHorizontal: true },
      eraser: { size: 2 },
    });
  });

  it("replaces the records it changes, so selectors see a new reference", () => {
    const store = createTestStore();
    store.getState().setSetting("eraser", "size", 2);
    const before = store.getState().settings;

    store.getState().setSetting("pencil", "size", 3);

    expect(store.getState().settings).not.toBe(before);
    expect(store.getState().settings.eraser).toBe(before.eraser);
  });

  it("keeps settings through tool switches", () => {
    const store = createTestStore();
    store.getState().setSetting("pencil", "mirrorHorizontal", true);

    store.getState().setTool("eraser");
    store.getState().setTool("pencil");

    expect(store.getState().settings.pencil).toEqual({ mirrorHorizontal: true });
  });
});
