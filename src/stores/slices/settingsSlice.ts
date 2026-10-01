import type { StoredValues } from "@/framework/settings";
import type { SliceCreator } from "@/stores/slices/types";

/**
 * Every tool's settings, keyed by tool id and then by the setting's key. Absent means the tool's
 * declared default, so the store never names a setting: `resolveSettings` fills the rest.
 */
export interface SettingsSlice {
  settings: Readonly<Record<string, StoredValues>>;
  setSetting: (toolId: string, key: string, value: number | boolean) => void;
}

export const createSettingsSlice: SliceCreator<SettingsSlice> = (set) => ({
  settings: {},

  setSetting: (toolId, key, value) =>
    set(({ settings }) => ({
      settings: { ...settings, [toolId]: { ...settings[toolId], [key]: value } },
    })),
});
