import type { ToolId } from "@/constants/tools";
import type { SpriteDocument } from "@/editor/document";
import type { History, StrokeRecorder } from "@/editor/history";
import type { OverlayPainter } from "@/editor/renderer";
import type { RGBA } from "@/lib/color";

/** Integer sprite-space pixel. */
export interface ToolPoint {
  x: number;
  y: number;
}

export interface PointerModifiers {
  /** 0 = primary colour, 2 = secondary colour. */
  button: number;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
}

export interface ToolOptions {
  brushSize: number;
  mirrorHorizontal: boolean;
  mirrorVertical: boolean;
  /** The colour picker samples the merged image rather than the active layer. */
  pickFromComposite: boolean;
}

/**
 * The option groups a tool can support. A tool declares these on itself (see `Tool.options`),
 * and both the options bar and the brush preview read that declaration — so an option can never
 * be offered or previewed by a surface that the tool itself ignores.
 */
export type ToolOptionField = "brushSize" | "mirror" | "pickSource";

export interface ToolContext {
  readonly doc: SpriteDocument;
  readonly layerId: string;
  readonly frameId: string;
  /** Already resolved from the mouse button — tools never read the store. */
  readonly color: RGBA;
  readonly options: ToolOptions;
  readonly stroke: StrokeRecorder;

  setColor(color: RGBA): void;
  setOverlay(painter: OverlayPainter | null, animate?: boolean): void;
}

/** Long-lived services a tool gets while it is the active tool (see `Tool.onActivate`). */
export interface ToolSession {
  readonly doc: SpriteDocument;
  readonly history: History;
  /** This tool's persistent overlay, drawn under the per-gesture one. Removed on deactivate. */
  setOverlay(painter: OverlayPainter | null): void;
  /** Repaints the overlay after the tool's own state changed. */
  requestRender(): void;
}

export interface Tool {
  readonly id: ToolId;
  readonly label: string;
  /** Whether a drag continues the operation (pencil) or is a one-shot (bucket). */
  readonly continuous: boolean;
  /**
   * The options this tool actually reads from `ctx.options`. Declaring one it ignores is what
   * put an inert Mirror toggle (and its mirrored brush preview) on the eraser, so keep this
   * list honest: it is the only thing the UI consults.
   */
  readonly options: readonly ToolOptionField[];

  onPointerDown(ctx: ToolContext, point: ToolPoint, modifiers: PointerModifiers): void;
  onPointerMove?(
    ctx: ToolContext,
    point: ToolPoint,
    previous: ToolPoint,
    modifiers: PointerModifiers,
  ): void;
  onPointerUp?(ctx: ToolContext, point: ToolPoint, modifiers: PointerModifiers): void;

  /**
   * Runs when the tool becomes active; the returned cleanup runs when it stops being active
   * (tool switch, held-key swap, editor unmount). Anything a tool remembers between gestures
   * lives between these two calls and is reset by the cleanup — so no other tool, slice or hook
   * can ever observe it.
   */
  onActivate?(session: ToolSession): () => void;
  /** Hover with no button held (`null` = pointer left). Returns a CSS cursor, or null for the default. */
  onHover?(point: ToolPoint | null): string | null;
}
