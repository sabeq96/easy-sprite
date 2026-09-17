import { useEffect } from "react";
import { usePalettes } from "@/hooks/usePalettes";
import { hexToRgba } from "@/lib/color";
import { isTypingTarget } from "@/lib/keys";
import { useEditorStore } from "@/stores/useEditorStore";

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

      const slot = Number(event.key);
      if (!Number.isInteger(slot) || slot < 1 || slot > 9) return;

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
