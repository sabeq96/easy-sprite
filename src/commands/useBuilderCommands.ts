import { useNavigate } from "react-router";
import { useSpritesheetSession } from "@/app/SpritesheetProvider";
import { BUILDER_COMMANDS } from "@/commands/builderCommands";
import { bindCommands } from "@/commands/define";
import type { CommandRegistry } from "@/commands/types";
import type { Size } from "@/core/viewport";

/** The Builder's registry: `BUILDER_COMMANDS` bound to the open sheet's session. */
export function useBuilderCommands(sheet: Size, onHelp: () => void): CommandRegistry {
  const { history, autosave } = useSpritesheetSession();
  const navigate = useNavigate();

  return bindCommands(BUILDER_COMMANDS, {
    history,
    sheet,
    navigate: (to) => void navigate(to),
    showHelp: onHelp,
    save: () => autosave.flush(),
  });
}
