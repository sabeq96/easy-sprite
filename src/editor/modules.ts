import type { CommandRegistry } from "@/commands/types";
import { module as animation } from "@/editor/animation/api";
import { module as canvas } from "@/editor/canvas/api";
import { module as frames } from "@/editor/frames/api";
import { module as layers } from "@/editor/layers/api";
import { bindCommands, type EditorModule, type ModuleContext } from "@/editor/module";
import { module as palette } from "@/editor/palette/api";
import { module as shell } from "@/editor/shell/api";
import { module as toolbox } from "@/editor/toolbox/api";
import { module as view } from "@/editor/view/api";

/**
 * Every host module, in the order their commands, hints and painters are applied. Rows in one
 * cheat-sheet group follow this order: view comes before animation, so the View group lists zoom,
 * fit and grid before the onion toggle, and canvas comes after palette, so the Color group lists
 * the 1–9 keys before "Paint with secondary color".
 */
const MODULES = [shell, palette, layers, frames, view, animation, toolbox, canvas] as const;

export const EDITOR_MODULES: readonly EditorModule[] = MODULES;

type CommandIdOf<M> = M extends EditorModule<infer Id> ? Id : never;

/** Every command id a module declares, derived from the list, so a typo is a type error. */
export type ModuleCommandId = CommandIdOf<(typeof MODULES)[number]>;

/** The editor's registry: every module's commands bound to the open document, in module order. */
export function bindEditorCommands(ctx: ModuleContext): CommandRegistry {
  return bindCommands(
    EDITOR_MODULES.flatMap((editorModule) => editorModule.commands ?? []),
    ctx,
  );
}

/** Every module store's `subscribe` as one, so a command's state follows whichever store it reads. */
export function subscribeToModules(listener: () => void): () => void {
  const unsubscribes = EDITOR_MODULES.flatMap((editorModule) =>
    editorModule.subscribe ? [editorModule.subscribe(listener)] : [],
  );
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}
