import type { ContributedCommand } from "@/framework/command";
import { resolveSettings, type Settings, type SettingValues } from "@/framework/settings";
import type { Tool } from "@/framework/tool";
import { useToolboxStore } from "./store";

export interface ToolSettings<S extends Settings> {
  values: SettingValues<S>;
  set: <K extends keyof S>(key: K, value: S[K]["default"]) => void;
}

/** A tool's settings for React code: live values (defaults filled in) and a setter. */
export function useToolSettings<S extends Settings>(
  tool: Tool<string, readonly ContributedCommand[], S>,
): ToolSettings<S> {
  // The stored record, not the resolved values: a selector must return a stable reference.
  const stored = useToolboxStore((state) => state.settings[tool.id]);
  const setSetting = useToolboxStore((state) => state.setSetting);

  return {
    values: resolveSettings(tool.settings, stored),
    set: (key, value) => setSetting(tool.id, String(key), value),
  };
}
