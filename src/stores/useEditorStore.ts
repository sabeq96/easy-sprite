import { create } from "zustand";
import { createColorSlice } from "@/stores/slices/colorSlice";
import { createToolSlice } from "@/stores/slices/toolSlice";
import { createViewSlice } from "@/stores/slices/viewSlice";
import type { EditorStore } from "@/stores/slices/types";

export const useEditorStore = create<EditorStore>()((...args) => ({
  ...createViewSlice(...args),
  ...createToolSlice(...args),
  ...createColorSlice(...args),
}));
