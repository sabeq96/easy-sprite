import type { StoreApi } from "zustand";
import { useAnimationStore } from "@/editor/animation/api";
import { useFramesStore } from "@/editor/frames/api";
import { useLayersStore } from "@/editor/layers/api";
import { usePaletteStore } from "@/editor/palette/api";
import { useToolboxStore } from "@/editor/toolbox/api";
import { useViewStore } from "@/editor/view/api";

function reset<T>(store: StoreApi<T>): void {
  store.setState(store.getInitialState(), true);
}

/** Puts every editor module store back to its initial state. */
export function resetEditorStores(): void {
  reset(usePaletteStore);
  reset(useLayersStore);
  reset(useFramesStore);
  reset(useAnimationStore);
  reset(useViewStore);
  reset(useToolboxStore);
}
