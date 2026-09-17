import type { ToolId } from "@/constants/tools";
import type { SpriteDocument } from "@/editor/document";
import type { StrokeRecorder } from "@/editor/history";
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

export interface ToolContext {
  readonly doc: SpriteDocument;
  readonly layerId: string;
  readonly frameId: string;
  /** Already resolved from the mouse button — tools never read the store. */
  readonly color: RGBA;
  readonly options: ToolOptions;
  readonly stroke: StrokeRecorder;
  /** Null when nothing is selected; otherwise 1 byte per pixel, 1 = editable. */
  readonly mask: Uint8Array | null;

  setColor(color: RGBA): void;
  setOverlay(painter: OverlayPainter | null, animate?: boolean): void;
}

export interface Tool {
  readonly id: ToolId;
  readonly label: string;
  /** Whether a drag continues the operation (pencil) or is a one-shot (bucket). */
  readonly continuous: boolean;

  onPointerDown(ctx: ToolContext, point: ToolPoint, modifiers: PointerModifiers): void;
  onPointerMove?(
    ctx: ToolContext,
    point: ToolPoint,
    previous: ToolPoint,
    modifiers: PointerModifiers,
  ): void;
  onPointerUp?(ctx: ToolContext, point: ToolPoint, modifiers: PointerModifiers): void;
  onCancel?(ctx: ToolContext): void;
}
