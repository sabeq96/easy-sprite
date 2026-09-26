import { AUTOSAVE_DEBOUNCE_MS } from "@/constants/storage";

export type SaveStatus = "idle" | "pending" | "saving" | "error";

/** What one editor saves: when its document changes, and how to write what changed. */
export interface SaveSource {
  /** Calls `onChange` on every edit worth saving; returns the unsubscribe. */
  subscribe(onChange: () => void): () => void;
  /**
   * Writes whatever changed since the last write. Decides synchronously: "clean" when there is
   * nothing to write, so a no-op flush never shows "saving".
   */
  write(): "clean" | Promise<void>;
}

/**
 * Deferred saving, shared by every editor: edits are written once they pause for
 * AUTOSAVE_DEBOUNCE_MS, on `flush` (⌘S, export, leaving the page), or when the tab is hidden.
 * What gets written is the source's business; when it gets written is this class's alone — the
 * one place to change the cadence.
 */
export class Autosave {
  private readonly source: SaveSource;
  private readonly onStatus: (status: SaveStatus) => void;
  private readonly unsubscribe: () => void;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private disposed = false;

  constructor(source: SaveSource, onStatus: (status: SaveStatus) => void) {
    this.source = source;
    this.onStatus = onStatus;
    this.unsubscribe = source.subscribe(() => this.schedule());

    // Tab hide is the only reliably delivered "about to lose the page" signal.
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  schedule(): void {
    if (this.disposed) return;
    this.onStatus("pending");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), AUTOSAVE_DEBOUNCE_MS);
  }

  /** Writes now. Awaited on route change and before export. Safe to call concurrently. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.inFlight) return this.inFlight;

    const write = this.source.write();
    if (write === "clean") {
      this.onStatus("idle");
      return;
    }

    this.onStatus("saving");
    this.inFlight = (async () => {
      try {
        await write;
        this.onStatus("idle");
      } catch (error) {
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
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.unsubscribe();
  }

  /** Flush that ignores the disposed flag, for the unmount path. */
  async flushAndDispose(): Promise<void> {
    const pending = this.flush();
    this.dispose();
    await pending;
  }

  private onVisibilityChange = () => {
    if (document.visibilityState === "hidden") void this.flush();
  };
}
