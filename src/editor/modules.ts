import type { EditorModule } from "@/editor/module";
import { module as shell } from "@/editor/shell/api";

/** Every host module, in the order their commands, hints and painters are applied. */
export const EDITOR_MODULES: readonly EditorModule[] = [shell];
