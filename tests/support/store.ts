import { create } from "zustand";
import { createColorSlice } from "@/stores/slices/colorSlice";
import { createSelectionSlice } from "@/stores/slices/selectionSlice";
import { createToolSlice } from "@/stores/slices/toolSlice";
import { createViewSlice } from "@/stores/slices/viewSlice";
import type { EditorStore } from "@/stores/slices/types";

/** Same slice composition as `useEditorStore`, but a fresh instance per test. */
export function createTestStore() {
  return create<EditorStore>()((...args) => ({
    ...createViewSlice(...args),
    ...createToolSlice(...args),
    ...createColorSlice(...args),
    ...createSelectionSlice(...args),
  }));
}
