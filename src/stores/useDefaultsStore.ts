import { toast } from "sonner";
import { create } from "zustand";
import { BUILT_IN_DEFAULTS, type Defaults } from "@/constants/defaults";
import { SETTING_KEYS } from "@/constants/settings";
import { readSetting, writeSetting } from "@/db/repositories/settings";
import { resolveDefaults, validDefaults } from "@/lib/defaults";
import { clamp } from "@/lib/math";
import { maxTileCount } from "@/lib/tiles";

export interface DefaultsState {
  /** Always complete: the stored values, the built-in for the rest. */
  defaults: Defaults;
  /** Only the values the user changed — what is written to the settings table. */
  stored: Partial<Defaults>;

  load: () => Promise<void>;
  set: <K extends keyof Defaults>(key: K, value: Defaults[K]) => void;
  reset: (keys: readonly (keyof Defaults)[]) => void;
}

/** A failed write keeps the value for this session; the next successful write saves it too. */
function persist(stored: Partial<Defaults>): void {
  writeSetting(SETTING_KEYS.defaults, stored).catch((error: unknown) => {
    console.error("Could not save defaults", error);
    toast.error("Could not save defaults.");
  });
}

/** A smaller cap from a bigger tile pulls stored columns and rows back under it. */
function clampCounts(stored: Partial<Defaults>): Partial<Defaults> {
  const max = maxTileCount(stored.tileSize ?? BUILT_IN_DEFAULTS.tileSize);
  const next = { ...stored };
  if (next.spriteColumns !== undefined) next.spriteColumns = clamp(next.spriteColumns, 1, max);
  if (next.spriteRows !== undefined) next.spriteRows = clamp(next.spriteRows, 1, max);
  return next;
}

/**
 * The user's defaults, read once per create or open (`getState()`), never subscribed to by the
 * editor — so changing a default never resets a sprite that is already open.
 */
export const useDefaultsStore = create<DefaultsState>()((set, get) => ({
  defaults: BUILT_IN_DEFAULTS,
  stored: {},

  load: async () => {
    try {
      const raw = await readSetting<unknown>(SETTING_KEYS.defaults, {});
      set({ stored: validDefaults(raw), defaults: resolveDefaults(raw) });
    } catch (error) {
      // Unreadable storage: the built-ins are what the app used before defaults existed.
      console.error("Could not read defaults", error);
      set({ stored: {}, defaults: BUILT_IN_DEFAULTS });
    }
  },

  set: (key, value) => {
    const stored = clampCounts({ ...get().stored, [key]: value });
    set({ stored, defaults: resolveDefaults(stored) });
    persist(stored);
  },

  reset: (keys) => {
    const stored = { ...get().stored };
    for (const key of keys) delete stored[key];
    set({ stored, defaults: resolveDefaults(stored) });
    persist(stored);
  },
}));

let loading: Promise<void> | null = null;

/** Loads the defaults once; later calls share that load. Never rejects. */
export function loadDefaults(): Promise<void> {
  loading ??= useDefaultsStore.getState().load();
  return loading;
}

/** Reads the defaults again, after a restore or a wipe replaced them underneath the store. */
export function reloadDefaults(): Promise<void> {
  loading = useDefaultsStore.getState().load();
  return loading;
}
