import { describe, expect, it } from "vitest";
import {
  bindingSignature,
  formatBinding,
  IS_APPLE,
  isTypingTarget,
  matchesBinding,
} from "@/lib/keys";

function keyEvent(init: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

describe("matchesBinding", () => {
  it("requires every modifier to match, not just the key", () => {
    const binding = { key: "z", mod: true, shift: true };
    expect(matchesBinding(keyEvent({ key: "z", metaKey: true, shiftKey: true }), binding)).toBe(
      IS_APPLE,
    );
    expect(matchesBinding(keyEvent({ key: "z", ctrlKey: true, shiftKey: true }), binding)).toBe(
      !IS_APPLE,
    );
    expect(matchesBinding(keyEvent({ key: "z", metaKey: true }), binding)).toBe(false);
  });

  it("is case-insensitive on the key itself", () => {
    const binding = { key: "p" };
    const event = new KeyboardEvent("keydown", { key: "P" });
    expect(matchesBinding(event, binding)).toBe(true);
  });

  it("rejects an unrelated key even with matching modifiers", () => {
    const binding = { key: "z", mod: true };
    const mod = IS_APPLE ? { metaKey: true } : { ctrlKey: true };
    expect(matchesBinding(keyEvent({ key: "y", ...mod }), binding)).toBe(false);
  });
});

describe("bindingSignature", () => {
  it("is stable for the same binding and distinct across modifiers", () => {
    expect(bindingSignature({ key: "z", mod: true })).toBe(bindingSignature({ key: "z", mod: true }));
    expect(bindingSignature({ key: "z", mod: true })).not.toBe(
      bindingSignature({ key: "z", mod: true, shift: true }),
    );
  });
});

describe("formatBinding", () => {
  it("renders a single-letter key uppercase with the platform modifier", () => {
    const expectedPrefix = IS_APPLE ? "⌘" : "Ctrl+";
    expect(formatBinding({ key: "g", mod: true })).toBe(`${expectedPrefix}G`);
  });

  it("uses a named label for keys with no printable glyph", () => {
    expect(formatBinding({ key: "escape" })).toBe("Esc");
    expect(formatBinding({ key: "arrowleft" })).toBe("←");
  });
});

describe("isTypingTarget", () => {
  it("treats inputs, textareas and selects as typing targets", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
  });

  // jsdom never resolves `isContentEditable` to true regardless of attachment (a long-standing
  // jsdom gap, not an app bug), so that branch is covered in the browser project instead.

  it("does not treat a plain button or null target as typing", () => {
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
