import { create, type StoreApi } from "zustand";
import { useAnimationStore } from "@/editor/animation/api";
import { useFramesStore } from "@/editor/frames/api";
import { useLayersStore } from "@/editor/layers/api";
import { usePaletteStore } from "@/editor/palette/api";
import { createSettingsSlice } from "@/stores/slices/settingsSlice";
import { createToolSlice } from "@/stores/slices/toolSlice";
import { createViewSlice } from "@/stores/slices/viewSlice";
import type { EditorStore } from "@/stores/slices/types";
import { useEditorStore } from "@/stores/useEditorStore";

/** Same slice composition as `useEditorStore`, but a fresh instance per test. */
export function createTestStore() {
  return create<EditorStore>()((...args) => ({
    ...createViewSlice(...args),
    ...createToolSlice(...args),
    ...createSettingsSlice(...args),
  }));
}

function reset<T>(store: StoreApi<T>): void {
  store.setState(store.getInitialState(), true);
}

/** Puts the editor store and every module store back to their initial state. */
export function resetEditorStores(): void {
  reset(useEditorStore);
  reset(usePaletteStore);
  reset(useLayersStore);
  reset(useFramesStore);
  reset(useAnimationStore);
}
