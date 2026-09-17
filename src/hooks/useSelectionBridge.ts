import { useEffect } from "react";
import { configureSelectionBridge } from "@/editor/tools/select";
import { useEditorStore } from "@/stores/useEditorStore";

/** Hands the React-free selection tools read/write access to the store, once. */
export function useSelectionBridge(): void {
  useEffect(() => {
    configureSelectionBridge({
      get: () => useEditorStore.getState().selection,
      set: (selection) => useEditorStore.getState().setSelection(selection),
      getPending: () => useEditorStore.getState().pendingRect,
      setPending: (rect) => useEditorStore.getState().setPendingRect(rect),
    });
  }, []);
}
