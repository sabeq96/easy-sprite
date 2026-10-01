import { CONTRIBUTED_COMMANDS } from "./contributed";
import { TOOL_COMMANDS } from "./toolCommands";

/**
 * One command per tool, then the commands tools contribute (the selection's copy, cut, paste, …)
 * and those their settings declare (the mirror toggle), all generated from `TOOL_LIST`.
 */
export const TOOLBOX_COMMANDS = [...TOOL_COMMANDS, ...CONTRIBUTED_COMMANDS];
