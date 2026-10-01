import type { Point, Viewport } from "@/core/viewport";
import type { RGBA } from "@/lib/color";
import type { Rect } from "@/lib/rect";
import type { Settings, SettingValues } from "@/framework/settings";
import type { PixelBuffer } from "@/types/pixels";

/**
 * What a tool may use, grouped by domain. Every member is a method, so every read is live: a
 * value cached at activation would silently go stale. A tool never sees the document, the undo
 * stack, the store, or layer and frame ids — only these interfaces.
 */
export interface ToolHost<S extends Settings = Settings> {
  readonly colors: Colors;
  readonly canvas: Canvas;
  readonly document: DocumentView;
  readonly history: Edits;
  readonly tool: ToolControl<S>;
}

/** Which colour a gesture paints or picks with: the left button is primary, the right secondary. */
export type ColorSlot = "primary" | "secondary";

export type OverlayPaint = (ctx: CanvasRenderingContext2D, viewport: Viewport) => void;

export interface PointerModifiers {
  /** The DOM button: 0 at a left press, 2 at a right one. Tools read `Gesture.slot` instead. */
  button: number;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
}

export interface Colors {
  get(slot: ColorSlot): RGBA;
  set(slot: ColorSlot, color: RGBA): void;
}

/** The active layer on the active frame, as something to draw on. */
export interface Surface {
  readonly width: number;
  readonly height: number;
  /** Transparent when out of bounds or nothing is drawn there. */
  read(x: number, y: number): RGBA;
  /** Writable pixels. The first call creates the cel and snapshots it for undo. */
  buffer(): PixelBuffer;
  /** Records `dirty` as changed and repaints. Null or empty is a no-op. */
  commit(dirty: Rect | null): void;
  /** Puts back every pixel changed through this surface, and records nothing. */
  revert(): void;
}

export interface DocumentView {
  readonly width: number;
  readonly height: number;
  /** The merged image of the active frame at (x, y); null outside the sprite. */
  sampleComposite(x: number, y: number): RGBA | null;
  /** The active cel's pixels in `rect`, transparent where empty; null with no active target. */
  crop(rect: Rect): PixelBuffer | null;
  /** Called after the sprite's width or height changes. */
  onResize(listener: () => void): () => void;
}

export interface Canvas {
  /** The calling tool's overlay, drawn above the grid. Removed when the tool deactivates. */
  setOverlay(paint: OverlayPaint | null): void;
  requestRender(): void;
}

export interface Edits {
  /** One undoable edit of the active layer and frame. False when nothing is editable. */
  edit(label: string, change: (surface: Surface) => void): boolean;
  /** Undo or redo moved pixels (not a new edit). */
  onUndoRedo(listener: () => void): () => void;
}

/** The calling tool itself: its activation and its own declared settings. */
export interface ToolControl<S extends Settings = Settings> {
  /** Makes the calling tool active, synchronously. */
  activate(): void;
  /** Every declared setting's current value (its default until changed). */
  settings(): SettingValues<S>;
  set<K extends keyof S>(key: K, value: S[K]["default"]): void;
}

/** What is happening now: one sample of a pointer gesture. */
export interface Gesture {
  readonly point: Point;
  /** The previous sample of this gesture; equals `point` on pointerdown. */
  readonly previous: Point;
  readonly modifiers: PointerModifiers;
  readonly slot: ColorSlot;
  readonly surface: Surface;
}
