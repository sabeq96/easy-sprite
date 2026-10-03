import { useEffect, type RefObject } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import type { HintSection } from "@/commands/hints";
import { wheelZoomFactor } from "@/core/viewport";
import { useViewStore } from "@/editor/view/api";

export const CANVAS_VIEW_HINTS: HintSection = {
  group: "View",
  hints: [
    { action: "Zoom", inputs: [{ hold: "mod" }, { text: "Wheel" }] },
    { action: "Pan", inputs: [{ text: "Wheel" }] },
    { action: "Pan", inputs: [{ hold: "space" }, { pointer: "drag" }] },
    { action: "Pan", inputs: [{ pointer: "middle-drag" }] },
  ],
};

/**
 * ⌘/ctrl+wheel and trackpad pinch (which arrives as a ctrl+wheel) zoom smoothly at the cursor; a plain
 * wheel or two-finger scroll pans, as do space-drag and middle-drag. The view store keeps a sprite
 * that fits centred, so panning only moves one that overflows. Pointer painting lives elsewhere.
 */
export function useCanvasViewControls(containerRef: RefObject<HTMLElement | null>): void {
  const { doc } = useDocumentSession();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const sprite = { width: doc.width, height: doc.height };
    let spacePressed = false;
    let panning = false;
    let last = { x: 0, y: 0 };

    const onWheel = (event: WheelEvent) => {
      // passive:false — the browser's own page zoom and scroll must be prevented over the canvas.
      event.preventDefault();
      const view = useViewStore.getState();
      if (!event.ctrlKey && !event.metaKey) {
        view.panBy(-event.deltaX, -event.deltaY, sprite);
        return;
      }

      const rect = element.getBoundingClientRect();
      view.zoomByFactor(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        wheelZoomFactor(event.deltaY),
        sprite,
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spacePressed = true;
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spacePressed = false;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 1 && !spacePressed) return;
      event.preventDefault();
      panning = true;
      last = { x: event.clientX, y: event.clientY };
      element.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!panning) return;
      useViewStore.getState().panBy(event.clientX - last.x, event.clientY - last.y, sprite);
      last = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = () => {
      panning = false;
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [containerRef, doc]);
}
