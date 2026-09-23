import { useEffect } from "react";
import type { HintSection } from "@/commands/hints";
import { usePalettes } from "@/hooks/usePalettes";
import { hexToRgba } from "@/lib/color";
import { isTypingTarget } from "@/lib/keys";
import { useEditorStore } from "@/stores/useEditorStore";

/** Shown in the shortcut sheet and as the palette's hover card. */
export const COLOR_HOTKEY_HINTS: HintSection = {
  group: "Color",
  hints: [
    { action: "Pick primary", inputs: [{ text: "1–9" }] },
    { action: "Pick secondary", inputs: [{ hold: "shift" }, { text: "1–9" }] },
  ],
};

/**
 * Keys 1–9 pick palette slots. These live outside the static keymap because they depend on
 * async data — a shortcut whose target is loaded at runtime does not belong in a constant.
 */
export function useColorHotkeys(): void {
  const { active } = usePalettes();

  useEffect(() => {
    if (!active) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      // event.key reflects the shifted character (Shift+1 is "!"), so the digit must come
      // from the physical key instead — otherwise Shift+digit never matches.
      const digit = /^Digit([1-9])$/.exec(event.code);
      if (!digit) return;
      const slot = Number(digit[1]);

      const hex = active.colors[slot - 1];
      if (!hex) return;

      event.preventDefault();
      const color = hexToRgba(hex);
      const store = useEditorStore.getState();
      // Shift picks the secondary colour, matching the right-click behaviour on swatches.
      if (event.shiftKey) store.setSecondaryColor(color);
      else store.setPrimaryColor(color);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);
}
