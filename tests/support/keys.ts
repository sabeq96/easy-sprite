/**
 * Key events with a chosen `timeStamp`, so a tap and a hold differ by numbers rather than by
 * real waits. The shortcut handler listens on `window`, and these bubble there from `target`.
 */
export interface KeyEventOptions {
  /** `KeyboardEvent.code`, e.g. "KeyE". */
  code: string;
  /** The event's `timeStamp`. */
  at: number;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  target?: EventTarget;
}

function fireKey(type: "keydown" | "keyup", key: string, options: KeyEventOptions): KeyboardEvent {
  const { code, at, repeat = false, ctrlKey = false, metaKey = false, target = document.body } = options;
  const event = new KeyboardEvent(type, {
    key,
    code,
    repeat,
    ctrlKey,
    metaKey,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "timeStamp", { value: at });
  target.dispatchEvent(event);
  return event;
}

export const keyDown = (key: string, options: KeyEventOptions) => fireKey("keydown", key, options);
export const keyUp = (key: string, options: KeyEventOptions) => fireKey("keyup", key, options);

/** A full press of `key` held from `at` for `ms`. */
export function pressKey(key: string, code: string, at: number, ms: number): void {
  keyDown(key, { code, at });
  keyUp(key, { code, at: at + ms });
}
