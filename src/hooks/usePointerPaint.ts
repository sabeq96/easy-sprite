import { useEffect, type RefObject } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { compositeFrame } from "@/editor/composite";
import { StrokeRecorder } from "@/editor/history";
import { brushCursorPainter } from "@/editor/overlays/brushCursor";
import type { CanvasRenderer } from "@/editor/renderer";
import { getTool } from "@/editor/tools";
import type { PointerModifiers, ToolContext, ToolPoint } from "@/editor/tools/types";
import { screenToSprite } from "@/editor/viewport";
import { useCursorStore } from "@/stores/useCursorStore";
import { useEditorStore } from "@/stores/useEditorStore";

// Which tools preview a brush footprint, and whether that preview mirrors, both come from the
// tool's own declared options — a tool that ignores an option can never have it drawn for it.

interface ActiveStroke {
  pointerId: number;
  button: number;
  last: ToolPoint;
  recorder: StrokeRecorder;
}

/**
 * Turns DOM pointer events into tool calls. The only place a ToolContext is built, and the
 * owner of the stroke lifecycle.
 */
export function usePointerPaint(
  containerRef: RefObject<HTMLElement | null>,
  renderer: CanvasRenderer | null,
): void {
  const { doc, history } = useDocumentSession();

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !renderer) return;

    let active: ActiveStroke | null = null;
    let hover: ToolPoint | null = null;

    const toSprite = (event: PointerEvent): ToolPoint => {
      const rect = element.getBoundingClientRect();
      return screenToSprite(useEditorStore.getState().viewport, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    /** Rebuilt per event so tools always see current store state — it is a cheap object. */
    const buildContext = (recorder: StrokeRecorder, button: number): ToolContext | null => {
      const state = useEditorStore.getState();
      const layerId = state.activeLayerId ?? doc.layers.at(-1)?.id;
      const frameId = state.activeFrameId ?? doc.frames[0]?.id;
      if (!layerId || !frameId) return null;

      const layer = doc.getLayer(layerId);
      // Drawing on a locked or hidden layer is a no-op; the layer row shows why.
      if (!layer || layer.locked || !layer.visible) return null;

      return {
        doc,
        layerId,
        frameId,
        color: button === 2 ? state.secondaryColor : state.primaryColor,
        options: state.toolOptions,
        stroke: recorder,
        mask: state.selectionMask,
        setColor: (color) =>
          button === 2 ? state.setSecondaryColor(color) : state.setPrimaryColor(color),
        setOverlay: (painter, animate) => renderer.setOverlayPainter(painter, animate),
      };
    };

    const showBrushPreview = () => {
      const state = useEditorStore.getState();
      const toolOptions = getTool(state.toolId).options;
      if (active || !toolOptions.includes("brushSize")) return;

      const mirrors = toolOptions.includes("mirror");
      renderer.setOverlayPainter(
        brushCursorPainter(
          () => hover,
          () => useEditorStore.getState().toolOptions.brushSize,
          { width: doc.width, height: doc.height },
          {
            horizontal: mirrors && state.toolOptions.mirrorHorizontal,
            vertical: mirrors && state.toolOptions.mirrorVertical,
          },
        ),
        true,
      );
      renderer.invalidate("overlay");
    };

    const reportCursor = (point: ToolPoint | null) => {
      const outside =
        !point || point.x < 0 || point.y < 0 || point.x >= doc.width || point.y >= doc.height;
      if (outside) {
        useCursorStore.getState().setCursor(null, null);
        return;
      }

      const frameId = useEditorStore.getState().activeFrameId ?? doc.frames[0].id;
      const data = compositeFrame(doc, frameId)
        .getContext("2d")
        ?.getImageData(point.x, point.y, 1, 1).data;

      useCursorStore
        .getState()
        .setCursor(point, data ? { r: data[0], g: data[1], b: data[2], a: data[3] } : null);
    };

    const onPointerDown = (event: PointerEvent) => {
      // Middle-drag is panning, handled by useCanvasViewControls.
      if (event.button !== 0 && event.button !== 2) return;

      const tool = getTool(useEditorStore.getState().toolId);
      const recorder = new StrokeRecorder(doc, tool.label);
      const ctx = buildContext(recorder, event.button);
      if (!ctx) return;

      const point = toSprite(event);
      active = { pointerId: event.pointerId, button: event.button, last: point, recorder };

      // Capture so a stroke that leaves the canvas keeps painting until pointerup.
      element.setPointerCapture(event.pointerId);
      tool.onPointerDown(ctx, point, modifiersOf(event));
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!active) {
        hover = toSprite(event);
        reportCursor(hover);
        showBrushPreview();
        return;
      }

      const tool = getTool(useEditorStore.getState().toolId);
      const ctx = buildContext(active.recorder, active.button);
      if (!ctx || !tool.onPointerMove) return;

      // Coalesced events prevent gaps in fast strokes on high-refresh displays.
      const coalesced = event.getCoalescedEvents?.() ?? [];
      for (const sample of coalesced.length ? coalesced : [event]) {
        const point = toSprite(sample);
        if (point.x === active.last.x && point.y === active.last.y) continue;
        tool.onPointerMove(ctx, point, active.last, modifiersOf(sample));
        active.last = point;
      }

      hover = active.last;
      reportCursor(hover);
    };

    const endStroke = (event: PointerEvent) => {
      if (!active) return;

      const tool = getTool(useEditorStore.getState().toolId);
      const ctx = buildContext(active.recorder, active.button);
      if (ctx) tool.onPointerUp?.(ctx, toSprite(event), modifiersOf(event));

      // One stroke → at most one undo entry.
      const command = active.recorder.commit();
      if (command) history.push(command);

      if (element.hasPointerCapture(active.pointerId)) {
        element.releasePointerCapture(active.pointerId);
      }
      active = null;
      showBrushPreview();
    };

    const onPointerLeave = () => {
      if (active) return;
      hover = null;
      reportCursor(null);
      renderer.setOverlayPainter(null);
    };

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", endStroke);
    element.addEventListener("pointercancel", endStroke);
    element.addEventListener("pointerleave", onPointerLeave);
    // Right-drag paints with the secondary colour, so the context menu must not appear.
    element.addEventListener("contextmenu", preventDefault);

    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", endStroke);
      element.removeEventListener("pointercancel", endStroke);
      element.removeEventListener("pointerleave", onPointerLeave);
      element.removeEventListener("contextmenu", preventDefault);
    };
  }, [containerRef, renderer, doc, history]);
}

const preventDefault = (event: Event) => event.preventDefault();

function modifiersOf(event: PointerEvent): PointerModifiers {
  return {
    button: event.button,
    shift: event.shiftKey,
    alt: event.altKey,
    ctrl: event.ctrlKey || event.metaKey,
  };
}
