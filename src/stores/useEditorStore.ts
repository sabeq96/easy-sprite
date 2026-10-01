import { create } from "zustand";
import { createSettingsSlice } from "@/stores/slices/settingsSlice";
import { createToolSlice } from "@/stores/slices/toolSlice";
import type { EditorStore } from "@/stores/slices/types";

export const useEditorStore = create<EditorStore>()((...args) => ({
  ...createToolSlice(...args),
  ...createSettingsSlice(...args),
}));
