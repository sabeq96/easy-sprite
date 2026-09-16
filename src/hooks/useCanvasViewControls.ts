import { useEffect, type RefObject } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { useEditorStore } from "@/stores/useEditorStore";

/** Wheel zoom, space-drag and middle-drag panning. Pointer painting lives elsewhere. */
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
      // passive:false — the browser's page zoom must be prevented over the canvas.
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      useEditorStore
        .getState()
        .zoom(
          { x: event.clientX - rect.left, y: event.clientY - rect.top },
          event.deltaY < 0 ? 1 : -1,
          sprite,
        );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spacePressed = true;
      element.style.cursor = "grab";
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spacePressed = false;
      element.style.cursor = "";
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 1 && !spacePressed) return;
      event.preventDefault();
      panning = true;
      last = { x: event.clientX, y: event.clientY };
      element.setPointerCapture(event.pointerId);
      element.style.cursor = "grabbing";
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!panning) return;
      useEditorStore.getState().panBy(event.clientX - last.x, event.clientY - last.y);
      last = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = () => {
      if (!panning) return;
      panning = false;
      element.style.cursor = spacePressed ? "grab" : "";
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
