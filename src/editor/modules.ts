import { module as animation } from "@/editor/animation/api";
import { module as frames } from "@/editor/frames/api";
import { module as layers } from "@/editor/layers/api";
import type { EditorModule } from "@/editor/module";
import { module as palette } from "@/editor/palette/api";
import { module as shell } from "@/editor/shell/api";
import { module as view } from "@/editor/view/api";

/**
 * Every host module, in the order their commands, hints and painters are applied.
 * Palette comes before shell only while shell holds the canvas hints: the colour keys must stay
 * above "Paint with secondary color" in the sheet's Color group.
 */
export const EDITOR_MODULES: readonly EditorModule[] = [
  palette,
  shell,
  layers,
  frames,
  animation,
  view,
];
