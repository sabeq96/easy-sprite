import { useEffect } from "react";
import { HELD_TOOL_KEYS } from "@/commands/keymap";
import { isTypingTarget, type HeldModifier } from "@/lib/keys";
import { useEditorStore } from "@/stores/useEditorStore";

/** A tool's hold key borrows it while held (Alt → eyedropper, exactly like Piskel). Pixel editor only. */
export function useHeldToolKeys(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTypingTarget(event.target)) return;
      const heldTool = HELD_TOOL_KEYS[event.key.toLowerCase() as HeldModifier];
      if (heldTool) useEditorStore.getState().pushTemporaryTool(heldTool);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() in HELD_TOOL_KEYS) useEditorStore.getState().popTemporaryTool();
    };

    // Releasing a held modifier outside the window would otherwise leave the tool stuck.
    const onBlur = () => useEditorStore.getState().popTemporaryTool();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
}
