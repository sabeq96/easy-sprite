import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_DEBOUNCE_MS } from "@/constants/storage";
import { Autosave, type SaveSource, type SaveStatus } from "@/services/autosave";

/** A source whose `change()` simulates an edit and whose writes are counted. */
function stubSource(write: SaveSource["write"] = async () => undefined) {
  let notify = () => {};
  const source = {
    subscribe: vi.fn((onChange: () => void) => {
      notify = onChange;
      return vi.fn();
    }),
    write: vi.fn(write),
  };
  return { source, change: () => notify() };
}

describe("Autosave", () => {
  let statuses: SaveStatus[];
  const onStatus = (status: SaveStatus) => statuses.push(status);
  // Every instance listens on `document`; dispose each so one test's tab-hide can't flush another's.
  const created: Autosave[] = [];
  const track = (autosave: Autosave) => (created.push(autosave), autosave);

  beforeEach(() => {
    vi.useFakeTimers();
    statuses = [];
  });
  afterEach(() => {
    created.splice(0).forEach((autosave) => autosave.dispose());
    vi.useRealTimers();
  });

  it("writes once edits pause for the debounce, restarting it on every edit", async () => {
    const { source, change } = stubSource();
    track(new Autosave(source, onStatus));

    change();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 1);
    change();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 1);
    expect(source.write).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toBe("pending");

    await vi.advanceTimersByTimeAsync(1);
    expect(source.write).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe("idle");
  });

  it("flush writes straight away and cancels the pending timer", async () => {
    const { source, change } = stubSource();
    const autosave = track(new Autosave(source, onStatus));

    change();
    await autosave.flush();
    expect(source.write).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(source.write).toHaveBeenCalledTimes(1);
  });

  it("concurrent flushes share one write", async () => {
    let finish = () => {};
    const { source } = stubSource(() => new Promise<void>((resolve) => (finish = resolve)));
    const autosave = track(new Autosave(source, onStatus));

    const first = autosave.flush();
    const second = autosave.flush();
    finish();
    await Promise.all([first, second]);
    expect(source.write).toHaveBeenCalledTimes(1);
  });

  it("a flush with nothing to write goes straight to idle, never through saving", async () => {
    const { source } = stubSource(() => "clean");
    const autosave = track(new Autosave(source, onStatus));

    await autosave.flush();
    expect(statuses).toEqual(["idle"]);
  });

  it("after a failed write, the next edit's save retries it", async () => {
    let fail = true;
    const { source, change } = stubSource(async () => {
      if (fail) throw new Error("offline");
    });
    const autosave = track(new Autosave(source, onStatus));

    await expect(autosave.flush()).rejects.toThrow("offline");
    fail = false;
    change();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(source.write).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)).toBe("idle");
  });

  it("a failed write reports an error and rejects the flush", async () => {
    const { source } = stubSource(async () => {
      throw new Error("quota");
    });
    const autosave = track(new Autosave(source, onStatus));

    await expect(autosave.flush()).rejects.toThrow("quota");
    expect(statuses.at(-1)).toBe("error");
  });

  it("flushes when the tab is hidden, and stops listening once disposed", async () => {
    const { source, change } = stubSource();
    const autosave = track(new Autosave(source, onStatus));
    const hide = () => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    };

    change();
    hide();
    await vi.advanceTimersByTimeAsync(0);
    expect(source.write).toHaveBeenCalledTimes(1);

    autosave.dispose();
    change();
    hide();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(source.write).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
});
