import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { HintSection } from "@/commands/hints";
import { BUILDER_ZOOM_LEVELS } from "@/constants/builder";
import { wheelZoomFactor, type Point } from "@/core/viewport";
import { clamp } from "@/lib/math";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";

export const BUILDER_VIEW_HINTS: HintSection = {
  group: "View",
  hints: [{ action: "Zoom", inputs: [{ hold: "mod" }, { text: "Wheel" }] }],
};

/** The sheet point (in sprite px) that a wheel zoom must keep under the cursor (in client px). */
interface ZoomAnchor {
  sheet: Point;
  client: Point;
}

/**
 * ⌘/ctrl+wheel and trackpad pinch zoom the sheet smoothly, keeping the point under the cursor in
 * place; a plain wheel is left to the panel's native scrolling. The panel also reports its own size
 * here, so "fit to window" is a pure store read.
 */
export function useBuilderViewport(panelRef: RefObject<HTMLElement | null>): void {
  const zoom = useBuilderViewStore((state) => state.zoom);
  const anchorRef = useRef<ZoomAnchor | null>(null);

  useEffect(() => {
    const element = panelRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      // passive:false — the browser's own page zoom must be prevented over the sheet.
      event.preventDefault();
      const sheet = element.firstElementChild;
      const { zoom: current, zoomByFactor } = useBuilderViewStore.getState();
      const factor = wheelZoomFactor(event.deltaY);
      const next = clamp(
        current * factor,
        BUILDER_ZOOM_LEVELS[0],
        BUILDER_ZOOM_LEVELS[BUILDER_ZOOM_LEVELS.length - 1],
      );
      // At a ladder end nothing re-renders, so an anchor left here would be applied by the next ± press.
      if (!sheet || next === current) return;

      // Store updates re-render after this event, so a burst of events can arrive before the layout
      // catches up: keep the sheet point of an anchor not yet applied, measured against a settled layout.
      const rect = sheet.getBoundingClientRect();
      anchorRef.current = {
        sheet: anchorRef.current?.sheet ?? {
          x: (event.clientX - rect.left) / current,
          y: (event.clientY - rect.top) / current,
        },
        client: { x: event.clientX, y: event.clientY },
      };
      zoomByFactor(factor);
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

  // Before paint, once the blocks have re-laid out at the new zoom: scroll the anchored sheet point
  // back under the cursor. The browser clamps the scroll at the panel's edges.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const element = panelRef.current;
    const sheet = element?.firstElementChild;
    anchorRef.current = null;
    if (!anchor || !element || !sheet) return;

    const rect = sheet.getBoundingClientRect();
    element.scrollLeft += rect.left + anchor.sheet.x * zoom - anchor.client.x;
    element.scrollTop += rect.top + anchor.sheet.y * zoom - anchor.client.y;
  }, [zoom, panelRef]);
}
