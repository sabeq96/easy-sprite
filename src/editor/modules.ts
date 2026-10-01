import type { EditorModule } from "@/editor/module";
import { module as palette } from "@/editor/palette/api";
import { module as shell } from "@/editor/shell/api";

/**
 * Every host module, in the order their commands, hints and painters are applied.
 * Palette comes before shell only while shell holds the canvas hints: the colour keys must stay
 * above "Paint with secondary color" in the sheet's Color group.
 */
export const EDITOR_MODULES: readonly EditorModule[] = [palette, shell];
