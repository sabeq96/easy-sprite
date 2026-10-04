import { commandsFor } from "@/commands/define";
import { SESSION_COMMANDS, type SessionContext } from "@/commands/session";
import { BUILDER_ZOOM_LEVELS } from "@/constants/builder";
import { SHARED_KEYS } from "@/constants/shortcuts";
import type { Size } from "@/core/viewport";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";

/** What the Builder hands its commands. */
export interface BuilderContext extends SessionContext {
  /** The packed sheet, in sprite px: what "fit to window" fits. */
  readonly sheet: Size;
}

const view = () => useBuilderViewStore.getState();

/**
 * The Builder's commands: the session commands both surfaces share, then its own view
 * commands over its view store, with the pixel editor's view keys (`SHARED_KEYS`).
 */
export const BUILDER_COMMANDS = commandsFor<BuilderContext>()([
  ...SESSION_COMMANDS,
  {
    id: "view.zoomIn",
    label: "Zoom in",
    group: "View",
    keys: SHARED_KEYS["view.zoomIn"],
    isEnabled: () => view().zoom < BUILDER_ZOOM_LEVELS[BUILDER_ZOOM_LEVELS.length - 1],
    run: () => view().zoomBy(1),
  },
  {
    id: "view.zoomOut",
    label: "Zoom out",
    group: "View",
    keys: SHARED_KEYS["view.zoomOut"],
    isEnabled: () => view().zoom > BUILDER_ZOOM_LEVELS[0],
    run: () => view().zoomBy(-1),
  },
  {
    id: "view.fit",
    label: "Fit to window",
    group: "View",
    keys: SHARED_KEYS["view.fit"],
    run: ({ sheet }) => view().fit(sheet),
  },
  {
    id: "view.toggleGrid",
    label: "Toggle grid",
    group: "View",
    keys: SHARED_KEYS["view.toggleGrid"],
    isActive: () => view().gridEnabled,
    run: () => view().toggleGrid(),
  },
]);

/** Every command id the Builder declares, derived from its definitions. */
export type BuilderCommandId = (typeof BUILDER_COMMANDS)[number]["id"];
