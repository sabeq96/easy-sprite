import type { KeyBinding } from "@/lib/keys";
import type { LucideIcon } from "lucide-react";

/**
 * A command the host generates for a boolean setting: running it flips the value, and it is
 * enabled only while the declaring tool is active. `label` defaults to the setting's label.
 */
export interface SettingCommand<Id extends string = string> {
  readonly id: Id;
  readonly label?: string;
  readonly keys?: readonly KeyBinding[];
}

/** One of a few numbers, rendered as a toggle group. */
export interface ChoiceSetting {
  readonly kind: "choice";
  readonly label: string;
  readonly values: readonly number[];
  readonly default: number;
  /** Read after each value by assistive tech ("3 pixels"); the bare number when omitted. */
  readonly unit?: string;
}

/** A boolean shown as an icon button. Consecutive toggles of one `group` share its label. */
export interface ToggleSetting<Id extends string = string> {
  readonly kind: "toggle";
  readonly label: string;
  readonly icon: LucideIcon;
  readonly default: boolean;
  readonly group?: string;
  readonly command?: SettingCommand<Id>;
}

/** A boolean shown as a labelled switch. */
export interface SwitchSetting<Id extends string = string> {
  readonly kind: "switch";
  readonly label: string;
  readonly default: boolean;
  readonly command?: SettingCommand<Id>;
}

export type Setting = ChoiceSetting | ToggleSetting | SwitchSetting;
export type Settings = Readonly<Record<string, Setting>>;

/** The value of every declared setting, typed from the declaration. */
export type SettingValues<S extends Settings> = { readonly [K in keyof S]: S[K]["default"] };

/** What the host stores for one tool: only the settings changed from their default. */
export type StoredValues = Readonly<Record<string, number | boolean>>;

/** The keys of `S` that are choices, i.e. what `Tool.reselect` may name. */
export type ChoiceKey<S extends Settings> = string extends keyof S
  ? string
  : { [K in keyof S]: S[K] extends ChoiceSetting ? K : never }[keyof S];

/** Every command id declared by a setting of `S`. */
export type SettingCommandIdOf<S extends Settings> = {
  [K in keyof S]: S[K] extends ToggleSetting<infer Id> | SwitchSetting<infer Id> ? Id : never;
}[keyof S];

export function choice(spec: Omit<ChoiceSetting, "kind">): ChoiceSetting {
  return { kind: "choice", ...spec };
}

export function toggle<const Id extends string = never>(
  spec: Omit<ToggleSetting<Id>, "kind">,
): ToggleSetting<Id> {
  return { kind: "toggle", ...spec };
}

export function switchSetting<const Id extends string = never>(
  spec: Omit<SwitchSetting<Id>, "kind">,
): SwitchSetting<Id> {
  return { kind: "switch", ...spec };
}

/** The stored value of each declared setting, or its default when none is stored. */
export function resolveSettings<S extends Settings>(
  settings: S | undefined,
  stored: StoredValues | undefined,
): SettingValues<S> {
  const values: Record<string, number | boolean> = {};
  for (const [key, setting] of Object.entries(settings ?? {})) {
    values[key] = stored?.[key] ?? setting.default;
  }
  return values as SettingValues<S>;
}

/** The next value above `value`, wrapping to the first. */
export function nextChoice(setting: ChoiceSetting, value: number): number {
  return setting.values.find((candidate) => candidate > value) ?? setting.values[0];
}
