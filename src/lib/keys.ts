export interface KeyBinding {
  /** `event.key`, lowercased. */
  key: string;
  /** Ctrl on Windows/Linux, ⌘ on macOS — one table serves both platforms. */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export const IS_APPLE =
  typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform);

/**
 * Letters and named keys (e.g. "escape") produce the same `event.key` regardless of Shift, so
 * Shift is a real modifier for them and must match the binding exactly. A symbol or digit key
 * (e.g. "+", "?") already encodes Shift in which character was produced — the browser reports a
 * different `event.key` for the shifted and unshifted forms — so re-checking `shiftKey` there
 * would demand a physically-impossible combination for any binding that omits `shift: true`.
 */
function shiftIsSignificant(key: string): boolean {
  return key.length > 1 || /[a-z]/.test(key);
}

export function matchesBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
  const mod = IS_APPLE ? event.metaKey : event.ctrlKey;
  const shiftMatches = shiftIsSignificant(binding.key)
    ? event.shiftKey === Boolean(binding.shift)
    : true;

  return (
    event.key.toLowerCase() === binding.key &&
    mod === Boolean(binding.mod) &&
    shiftMatches &&
    event.altKey === Boolean(binding.alt)
  );
}

/** A stable signature used to detect two features claiming the same chord. */
export function bindingSignature(binding: KeyBinding): string {
  return [
    binding.mod ? "mod" : "",
    binding.shift ? "shift" : "",
    binding.alt ? "alt" : "",
    binding.key,
  ]
    .filter(Boolean)
    .join("+");
}

const KEY_LABELS: Record<string, string> = {
  arrowleft: "←",
  arrowright: "→",
  arrowup: "↑",
  arrowdown: "↓",
  escape: "Esc",
  delete: "Del",
  backspace: "⌫",
  pageup: "PgUp",
  pagedown: "PgDn",
  " ": "Space",
};

export type Modifier = "mod" | "shift" | "alt";

const MODIFIER_LABELS: Record<Modifier, [apple: string, other: string]> = {
  mod: ["⌘", "Ctrl"],
  shift: ["⇧", "Shift"],
  alt: ["⌥", "Alt"],
};

/**
 * Modifiers that can be held on their own to borrow a tool. `mod` is excluded: it is a platform
 * alias (⌘ or Ctrl), and a held key is matched on `event.key`, which reports "Meta"/"Control".
 */
export type HeldModifier = Exclude<Modifier, "mod">;

export function formatModifier(modifier: Modifier): string {
  return MODIFIER_LABELS[modifier][IS_APPLE ? 0 : 1];
}

/** `⌘⇧Z` on Apple, `Ctrl+Shift+Z` elsewhere. */
export function formatBinding(binding: KeyBinding): string {
  const parts: string[] = [];
  if (binding.mod) parts.push(formatModifier("mod"));
  if (binding.shift) parts.push(formatModifier("shift"));
  if (binding.alt) parts.push(formatModifier("alt"));

  const label =
    KEY_LABELS[binding.key] ??
    (binding.key.length === 1
      ? binding.key.toUpperCase()
      : binding.key[0].toUpperCase() + binding.key.slice(1));

  parts.push(label);
  return parts.join(IS_APPLE ? "" : "+");
}

/** Typing must never trigger a tool change; Escape is the one key that always gets through. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["input", "textarea", "select"].includes(target.tagName.toLowerCase());
}
