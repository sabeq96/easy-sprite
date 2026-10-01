import { create } from "zustand";
import { createSettingsSlice } from "@/stores/slices/settingsSlice";
import { createToolSlice } from "@/stores/slices/toolSlice";
import { createViewSlice } from "@/stores/slices/viewSlice";
import type { EditorStore } from "@/stores/slices/types";

export const useEditorStore = create<EditorStore>()((...args) => ({
  ...createViewSlice(...args),
  ...createToolSlice(...args),
  ...createSettingsSlice(...args),
}));
