import { useEffect, type RefObject } from "react";
import type { HintSection } from "@/commands/hints";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";

export const BUILDER_VIEW_HINTS: HintSection = {
  group: "View",
  hints: [{ action: "Zoom", inputs: [{ hold: "mod" }, { text: "Wheel" }] }],
};

/**
 * ⌘/ctrl+wheel zooms the sheet; a plain wheel keeps scrolling it, because unlike the pixel canvas
 * the sheet genuinely overflows and scrolling is the more common intent. The panel also reports its
 * own size here, so "fit to window" is a pure store read.
 */
export function useBuilderViewport(panelRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = panelRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      // passive:false — the browser's own page zoom must be prevented over the sheet.
      event.preventDefault();
      useBuilderViewStore.getState().zoomBy(event.deltaY < 0 ? 1 : -1);
    };

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      useBuilderViewStore.getState().setContainerSize({ width, height });
    });

    element.addEventListener("wheel", onWheel, { passive: false });
    observer.observe(element);

    return () => {
      element.removeEventListener("wheel", onWheel);
      observer.disconnect();
    };
  }, [panelRef]);
}
