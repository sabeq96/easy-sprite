import { AUTOSAVE_DEBOUNCE_MS, THUMBNAIL_THROTTLE_MS } from "@/constants/storage";
import { flushCels } from "@/db/repositories/cels";
import { saveDocumentStructure } from "@/services/documentService";
import { saveThumbnail } from "@/services/thumbnails";
import type { SpriteDocument } from "@/editor/document";

export type SaveStatus = "idle" | "pending" | "saving" | "error";

export class AutosaveController {
  private readonly doc: SpriteDocument;
  private readonly onStatus: (status: SaveStatus) => void;
  private readonly unsubscribes: (() => void)[] = [];

  private timer: ReturnType<typeof setTimeout> | null = null;
  private structureDirty = false;
  private inFlight: Promise<void> | null = null;
  private lastThumbnailAt = 0;
  private disposed = false;

  constructor(doc: SpriteDocument, onStatus: (status: SaveStatus) => void) {
    this.doc = doc;
    this.onStatus = onStatus;

    this.unsubscribes.push(doc.events.on("pixels", () => this.schedule()));
    this.unsubscribes.push(
      doc.events.on("structure", () => {
        this.structureDirty = true;
        this.schedule();
      }),
    );
    this.unsubscribes.push(
      doc.events.on("meta", () => {
        this.structureDirty = true;
        this.schedule();
      }),
    );

    // Tab hide is the only reliably delivered "about to lose the page" signal.
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  schedule(): void {
    if (this.disposed) return;
    this.onStatus("pending");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), AUTOSAVE_DEBOUNCE_MS);
  }

  /** Awaited on route change and before export. Safe to call concurrently. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.inFlight) return this.inFlight;

    const dirty = this.doc.takeDirtyCels();
    const needsStructure = this.structureDirty;
    this.structureDirty = false;

    if (dirty.length === 0 && !needsStructure) {
      this.onStatus("idle");
      return;
    }

    this.onStatus("saving");
    this.inFlight = (async () => {
      try {
        if (dirty.length) {
          await flushCels(dirty.map((cel) => ({ ...cel, spriteId: this.doc.id })));
        }
        if (needsStructure) await saveDocumentStructure(this.doc);
        await this.maybeSaveThumbnail();
        this.onStatus("idle");
      } catch (error) {
        // Put the structural work back so the next flush retries instead of losing it.
        this.structureDirty ||= needsStructure;
        this.onStatus("error");
        throw error;
      } finally {
        this.inFlight = null;
      }
    })();

    return this.inFlight;
  }

  dispose(): void {
    this.disposed = true;
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes.length = 0;
  }

  /** Flush that ignores the disposed flag, for the unmount path. */
  async flushAndDispose(): Promise<void> {
    const pending = this.flush();
    this.dispose();
    await pending;
  }

  private async maybeSaveThumbnail(): Promise<void> {
    const now = Date.now();
    if (now - this.lastThumbnailAt < THUMBNAIL_THROTTLE_MS) return;
    this.lastThumbnailAt = now;
    await saveThumbnail(this.doc);
  }

  private onVisibilityChange = () => {
    if (document.visibilityState === "hidden") void this.flush();
  };
}
