import { module as animation } from "@/editor/animation/api";
import { module as canvas } from "@/editor/canvas/api";
import { module as frames } from "@/editor/frames/api";
import { module as layers } from "@/editor/layers/api";
import type { EditorModule } from "@/editor/module";
import { module as palette } from "@/editor/palette/api";
import { module as shell } from "@/editor/shell/api";
import { module as toolbox } from "@/editor/toolbox/api";
import { module as view } from "@/editor/view/api";

/**
 * Every host module, in the order their commands, hints and painters are applied. Hint rows in
 * one cheat-sheet group follow this order: canvas comes after palette, so the Color group lists
 * the 1–9 keys before "Paint with secondary color".
 */
export const EDITOR_MODULES: readonly EditorModule[] = [
  shell,
  palette,
  layers,
  frames,
  animation,
  view,
  toolbox,
  canvas,
];

/** Every module store's `subscribe` as one, so a command's state follows whichever store it reads. */
export function subscribeToModules(listener: () => void): () => void {
  const unsubscribes = EDITOR_MODULES.flatMap((editorModule) =>
    editorModule.subscribe ? [editorModule.subscribe(listener)] : [],
  );
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}
