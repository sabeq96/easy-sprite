import { HISTORY_MAX_BYTES, HISTORY_MAX_ENTRIES } from "@/constants/storage";
import { cropRegion, pasteRegion } from "@/editor/buffer";
import type { SpriteDocument } from "@/editor/document";
import { Emitter } from "@/editor/emitter";
import { rectUnion, type Rect } from "@/lib/rect";
import type { PixelBuffer } from "@/types/pixels";

export interface Command {
  readonly label: string;
  /** Approximate retained bytes, used to bound total history memory. */
  readonly sizeBytes: number;
  undo(): void;
  redo(): void;
}

/** What changed, so listeners can tell a new entry apart from stepping through history. */
export type HistoryChange = "push" | "undo" | "redo" | "clear";

export interface HistoryEvents {
  change: HistoryChange;
}

export class History {
  readonly events = new Emitter<HistoryEvents>();
  /** Monotonic counter for useSyncExternalStore — see hooks/useHistoryState. */
  revision = 0;

  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private bytes = 0;

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoLabel(): string | null {
    return this.undoStack.at(-1)?.label ?? null;
  }

  get redoLabel(): string | null {
    return this.redoStack.at(-1)?.label ?? null;
  }

  /** Pushes an already-applied command. Commands are never executed on push. */
  push(command: Command): void {
    this.undoStack.push(command);
    this.bytes += command.sizeBytes;
    this.redoStack.length = 0;
    this.trim();
    this.changed("push");
  }

  undo(): void {
    const command = this.undoStack.pop();
    if (!command) return;
    command.undo();
    this.redoStack.push(command);
    this.changed("undo");
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (!command) return;
    command.redo();
    this.undoStack.push(command);
    this.changed("redo");
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.bytes = 0;
    this.changed("clear");
  }

  private changed(kind: HistoryChange): void {
    this.revision++;
    this.events.emit("change", kind);
  }

  private trim(): void {
    while (this.undoStack.length > HISTORY_MAX_ENTRIES || this.bytes > HISTORY_MAX_BYTES) {
      const dropped = this.undoStack.shift();
      if (!dropped) break;
      this.bytes -= dropped.sizeBytes;
    }
  }
}

interface CelPatch {
  layerId: string;
  frameId: string;
  rect: Rect;
  before: PixelBuffer;
  after: PixelBuffer;
}

/** One stroke = one undo step. Records the minimum rectangle that actually changed. */
export class StrokeRecorder {
  private readonly before = new Map<string, PixelBuffer>();
  private readonly rects = new Map<string, Rect>();
  private readonly doc: SpriteDocument;
  private readonly label: string;

  constructor(doc: SpriteDocument, label: string) {
    this.doc = doc;
    this.label = label;
  }

  /** Call before the first write to a cel in this stroke. Idempotent per cel. */
  touch(layerId: string, frameId: string): void {
    const key = `${layerId}:${frameId}`;
    if (this.before.has(key)) return;
    this.before.set(key, this.doc.snapshotCel(layerId, frameId));
  }

  /** Call after each write, with the bounds of what was written. */
  extend(layerId: string, frameId: string, rect: Rect): void {
    const key = `${layerId}:${frameId}`;
    this.rects.set(key, rectUnion(this.rects.get(key) ?? null, rect));
  }

  /** Null when the stroke changed nothing — e.g. filling with the colour already there. */
  commit(): Command | null {
    const patches: CelPatch[] = [];
    let bytes = 0;

    for (const [key, rawRect] of this.rects) {
      const separator = key.lastIndexOf(":");
      const layerId = key.slice(0, separator);
      const frameId = key.slice(separator + 1);

      const cel = this.doc.getCel(layerId, frameId);
      const before = this.before.get(key);
      const rect = clampRect(rawRect, this.doc.width, this.doc.height);
      if (!cel || !before || rect.w <= 0 || rect.h <= 0) continue;

      const beforeRegion = cropRegion(before, this.doc.width, rect);
      const afterRegion = cropRegion(cel.pixels, this.doc.width, rect);
      if (regionsEqual(beforeRegion, afterRegion)) continue;

      patches.push({ layerId, frameId, rect, before: beforeRegion, after: afterRegion });
      bytes += beforeRegion.length * 2;
    }

    return patches.length === 0 ? null : new PixelEditCommand(this.doc, this.label, patches, bytes);
  }
}

class PixelEditCommand implements Command {
  readonly label: string;
  readonly sizeBytes: number;
  private readonly doc: SpriteDocument;
  private readonly patches: CelPatch[];

  constructor(doc: SpriteDocument, label: string, patches: CelPatch[], sizeBytes: number) {
    this.doc = doc;
    this.label = label;
    this.patches = patches;
    this.sizeBytes = sizeBytes;
  }

  undo(): void {
    this.apply("before");
  }

  redo(): void {
    this.apply("after");
  }

  private apply(side: "before" | "after"): void {
    for (const patch of this.patches) {
      const cel = this.doc.ensureCel(patch.layerId, patch.frameId);
      pasteRegion(cel.pixels, this.doc.width, patch.rect, patch[side]);
      this.doc.markPixelsChanged(cel, patch.rect);
    }
  }
}

function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.min(rect.x, width));
  const y = Math.max(0, Math.min(rect.y, height));
  return {
    x,
    y,
    w: Math.max(0, Math.min(rect.w + rect.x - x, width - x)),
    h: Math.max(0, Math.min(rect.h + rect.y - y, height - y)),
  };
}

function regionsEqual(a: PixelBuffer, b: PixelBuffer): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}
