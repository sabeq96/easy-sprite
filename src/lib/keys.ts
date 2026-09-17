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

export function matchesBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
  const mod = IS_APPLE ? event.metaKey : event.ctrlKey;
  return (
    event.key.toLowerCase() === binding.key &&
    mod === Boolean(binding.mod) &&
    event.shiftKey === Boolean(binding.shift) &&
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

/** `⌘⇧Z` on Apple, `Ctrl+Shift+Z` elsewhere. */
export function formatBinding(binding: KeyBinding): string {
  const parts: string[] = [];
  if (binding.mod) parts.push(IS_APPLE ? "⌘" : "Ctrl");
  if (binding.shift) parts.push(IS_APPLE ? "⇧" : "Shift");
  if (binding.alt) parts.push(IS_APPLE ? "⌥" : "Alt");

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
