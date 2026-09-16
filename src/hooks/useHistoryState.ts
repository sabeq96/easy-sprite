import { useSyncExternalStore } from "react";
import type { History } from "@/editor/history";

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
}

/** History mutates in place, so the subscription reads its revision counter. */
export function useHistoryState(history: History): HistoryState {
  useSyncExternalStore(
    (onChange) => history.events.on("change", onChange),
    () => history.revision,
  );

  return {
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undoLabel: history.undoLabel,
    redoLabel: history.redoLabel,
  };
}
