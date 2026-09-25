import { useRef, useState } from "react";
import type { SaveStatus } from "@/services/autosave";

export interface SaveStatusTracker {
  status: SaveStatus;
  /** Reports the promise's progress as save status; returns it so callers can still await. */
  track: <T>(write: Promise<T>) => Promise<T>;
}

/**
 * Save status for surfaces that write straight through on every edit, rather than batching
 * behind an AutosaveController like the pixel editor does.
 *
 * Counts in-flight writes instead of tracking the latest one, so a burst of edits only reads
 * "Saved" once the last of them has actually landed.
 */
export function useSaveStatus(): SaveStatusTracker {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const inFlight = useRef(0);

  const track = async <T,>(write: Promise<T>): Promise<T> => {
    inFlight.current += 1;
    setStatus("saving");
    try {
      const result = await write;
      if (--inFlight.current === 0) setStatus("idle");
      return result;
    } catch (error) {
      inFlight.current -= 1;
      setStatus("error");
      throw error;
    }
  };

  return { status, track };
}
