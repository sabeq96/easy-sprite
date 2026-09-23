import { useState } from "react";

export interface OptimisticOrder<T> {
  /** What to render: the proposed list while it stands, otherwise what the store says. */
  items: T[];
  /** Render this immediately; it stands until the next live read arrives, whatever it contains. */
  propose: (items: T[]) => void;
}

/**
 * A write goes to Dexie and only comes back through useLiveQuery a few async ticks later — long
 * enough to watch a dropped item return to its old slot and animate over again. Rendering the
 * proposed list straight away makes the drop land where it was released.
 *
 * `stored` is only a new reference when the live query actually re-ran, so identity is an exact
 * "has the read caught up yet". Adjusting state during render rather than in an effect keeps a
 * competing edit — another tab, another drag — from ever flashing the stale guess first:
 * https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-based-on-a-prop-change
 */
export function useOptimisticOrder<T>(stored: T[]): OptimisticOrder<T> {
  const [guess, setGuess] = useState<T[] | null>(null);
  const [seen, setSeen] = useState(stored);

  if (stored !== seen) {
    setSeen(stored);
    if (guess) setGuess(null);
  }

  return { items: guess ?? stored, propose: setGuess };
}
