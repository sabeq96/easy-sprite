import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILT_IN_DEFAULTS } from "@/constants/defaults";
import { SETTING_KEYS } from "@/constants/settings";
import { db } from "@/db/db";
import { readSetting, writeSetting } from "@/db/repositories/settings";
import { reloadDefaults, useDefaultsStore } from "@/stores/useDefaultsStore";

const store = () => useDefaultsStore.getState();
const storedRow = () => readSetting<Record<string, unknown> | undefined>(SETTING_KEYS.defaults, undefined);

describe("defaults store", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    useDefaultsStore.setState(useDefaultsStore.getInitialState(), true);
  });

  it("starts at the built-ins when nothing is stored", async () => {
    await reloadDefaults();
    expect(store().defaults).toEqual(BUILT_IN_DEFAULTS);
    expect(store().stored).toEqual({});
  });

  it("set persists and survives a reload", async () => {
    store().set("previewFps", 12);
    expect(store().defaults.previewFps).toBe(12);
    await vi.waitFor(async () => expect(await storedRow()).toEqual({ previewFps: 12 }));

    useDefaultsStore.setState(useDefaultsStore.getInitialState(), true);
    await reloadDefaults();
    expect(store().defaults.previewFps).toBe(12);
  });

  it("reset removes the field", async () => {
    store().set("previewFps", 12);
    store().set("gridEnabled", false);
    store().reset(["previewFps"]);

    expect(store().defaults.previewFps).toBe(BUILT_IN_DEFAULTS.previewFps);
    await vi.waitFor(async () => expect(await storedRow()).toEqual({ gridEnabled: false }));
  });

  it("a bigger tile pulls stored columns and rows under its cap", () => {
    store().set("spriteColumns", 20);
    store().set("tileSize", 64);
    expect(store().defaults.spriteColumns).toBe(8);
  });

  it("ignores invalid stored fields on load", async () => {
    await writeSetting(SETTING_KEYS.defaults, { previewFps: 999, gridEnabled: false });
    await reloadDefaults();
    expect(store().stored).toEqual({ gridEnabled: false });
    expect(store().defaults.previewFps).toBe(BUILT_IN_DEFAULTS.previewFps);
  });
});
