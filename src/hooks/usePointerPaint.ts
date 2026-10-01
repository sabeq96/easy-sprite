import { useEffect, type RefObject } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import type { HintSection } from "@/commands/hints";
import { compositeFrame } from "@/core/composite";
import { StrokeRecorder } from "@/core/history";
import { brushCursorPainter } from "@/core/overlays/brushCursor";
import type { CanvasRenderer } from "@/core/renderer";
import { getTool } from "@/tools";
import type { ColorSlot, Gesture, PointerModifiers, Surface, ToolHost } from "@/framework/host";
import type { Tool, ToolPoint } from "@/framework/tool";
import { screenToSprite } from "@/core/viewport";
import { createSurface } from "@/hooks/toolHost/surface";
import { useToolHost } from "@/hooks/toolHost/ToolHostContext";
import { useCursorStore } from "@/stores/useCursorStore";
import { useEditorStore } from "@/stores/useEditorStore";

export const POINTER_PAINT_HINTS: HintSection = {
  group: "Color",
  hints: [{ action: "Paint with secondary color", inputs: [{ pointer: "right-drag" }] }],
};

// Which tools preview a brush footprint, and whether that preview mirrors, both come from the
// tool's own declared options — a tool that ignores an option can never have it drawn for it.

interface ActiveStroke {
  /** Pinned at pointerdown, so a tool switch mid-drag cannot hand the gesture to another tool. */
  tool: Tool;
  host: ToolHost;
  pointerId: number;
  /** The right button paints and picks with the secondary colour. */
  slot: ColorSlot;
  last: ToolPoint;
  recorder: StrokeRecorder;
  /** Pinned to the layer and frame at pointerdown: the whole stroke lands on one cel. */
  surface: Surface;
}

/**
 * Turns DOM pointer events into tool calls. The only place a Gesture is built, and the owner of
 * the stroke lifecycle.
 */
export function usePointerPaint(
  containerRef: RefObject<HTMLElement | null>,
  renderer: CanvasRenderer | null,
): void {
  const { doc, history } = useDocumentSession();
  const toolHost = useToolHost();

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

    /** The layer and frame a stroke lands on; null when drawing there is a no-op. */
    const resolveTarget = () => {
      const state = useEditorStore.getState();
      const layerId = state.activeLayerId ?? doc.layers.at(-1)?.id;
      const frameId = state.activeFrameId ?? doc.frames[0]?.id;
      if (!layerId || !frameId) return null;

      const layer = doc.getLayer(layerId);
      // Drawing on a locked or hidden layer is a no-op; the layer row shows why.
      if (!layer || layer.locked || !layer.visible) return null;
      return { layerId, frameId };
    };

    const gestureAt = (
      stroke: ActiveStroke,
      point: ToolPoint,
      previous: ToolPoint,
      modifiers: PointerModifiers,
    ): Gesture => ({ point, previous, modifiers, slot: stroke.slot, surface: stroke.surface });

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

    const updateHover = (point: ToolPoint | null) => {
      const tool = getTool(useEditorStore.getState().toolId);
      element.style.cursor = tool.onHover?.(toolHost.forTool(tool.id), point) ?? "";
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
      // Middle-drag is panning, handled by useCanvasViewControls — and so is a Space+drag, which
      // that hook claims first (its listener is attached before this one) by preventing default.
      if (event.button !== 0 && event.button !== 2) return;
      if (event.defaultPrevented) return;

      const tool = getTool(useEditorStore.getState().toolId);
      const target = resolveTarget();
      if (!target) return;

      const point = toSprite(event);
      const recorder = new StrokeRecorder(doc, tool.label);
      active = {
        tool,
        host: toolHost.forTool(tool.id),
        pointerId: event.pointerId,
        slot: event.button === 2 ? "secondary" : "primary",
        last: point,
        recorder,
        surface: createSurface(doc, target.layerId, target.frameId, recorder),
      };

      // Capture so a stroke that leaves the canvas keeps painting until pointerup.
      element.setPointerCapture(event.pointerId);
      tool.onPointerDown(active.host, gestureAt(active, point, point, modifiersOf(event)));
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!active) {
        hover = toSprite(event);
        reportCursor(hover);
        updateHover(hover);
        showBrushPreview();
        return;
      }

      const { tool } = active;
      if (!tool.onPointerMove) return;

      // Coalesced events prevent gaps in fast strokes on high-refresh displays.
      const coalesced = event.getCoalescedEvents?.() ?? [];
      for (const sample of coalesced.length ? coalesced : [event]) {
        const point = toSprite(sample);
        if (point.x === active.last.x && point.y === active.last.y) continue;
        tool.onPointerMove(active.host, gestureAt(active, point, active.last, modifiersOf(sample)));
        active.last = point;
      }

      hover = active.last;
      reportCursor(hover);
    };

    const endStroke = (event: PointerEvent) => {
      if (!active) return;

      const { tool } = active;
      tool.onPointerUp?.(
        active.host,
        gestureAt(active, toSprite(event), active.last, modifiersOf(event)),
      );

      // One stroke → at most one undo entry.
      const command = active.recorder.commit();
      if (command) history.push(command);

      if (element.hasPointerCapture(active.pointerId)) {
        element.releasePointerCapture(active.pointerId);
      }
      active = null;
      updateHover(toSprite(event));
      showBrushPreview();
    };

    const onPointerLeave = () => {
      if (active) return;
      hover = null;
      reportCursor(null);
      updateHover(null);
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
  }, [containerRef, renderer, doc, history, toolHost]);
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
