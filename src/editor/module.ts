import type { HintSection } from "@/commands/hints";
import { commandsFor, type CommandSpec } from "@/commands/define";
import type { SessionContext } from "@/commands/session";
import type { SpriteDocument } from "@/core/document";
import type { Command } from "@/core/history";
import type { CanvasRenderer } from "@/core/renderer";
import type { ToolHost } from "@/framework/host";
import type { ToolId } from "@/tools";

/** What the shell hands every module command: the session, plus the open sprite and its tools. */
export interface ModuleContext extends SessionContext {
  readonly doc: SpriteDocument;
  /** Runs a command factory and records the command for undo; false when it was a no-op. */
  dispatch(factory: () => Command | null): boolean;
  /** The open document's tool host as `toolId` sees it; tool-contributed commands run through it. */
  forTool(toolId: ToolId): ToolHost;
}

/**
 * One command a module declares, with its keys, the same shape as `Tool.commands`. The shell binds
 * it to the open document's `ModuleContext`; handlers read the module's store when they run.
 */
export type ModuleCommand<Id extends string = string> = CommandSpec<Id, ModuleContext>;

/**
 * One host domain's contributions to the editor; the shell and canvas read them from
 * `EDITOR_MODULES`. `Id` is the union of its command ids, kept literal by `defineModule`.
 */
export interface EditorModule<Id extends string = string> {
  readonly id: string;
  /** Static definitions; the shell binds them to the open document. */
  readonly commands?: readonly ModuleCommand<Id>[];
  /** Inputs owned by the module rather than a command; each joins the command group it names. */
  readonly hints?: readonly HintSection[];
  /** Registers painters or listeners on the renderer; the cleanup runs when it is disposed. */
  attachCanvas?(renderer: CanvasRenderer, doc: SpriteDocument): () => void;
  /** The module store's `subscribe`: bound controls re-read command state when it changes. */
  subscribe?(listener: () => void): () => void;
}

/** Keeps each definition's literal id, so `CommandId` can be derived from the module list. */
export const defineCommands = commandsFor<ModuleContext>();

/** Keeps the module's command ids literal, so `ModuleCommandId` can be derived from the list. */
export function defineModule<Id extends string = never>(
  editorModule: EditorModule<Id>,
): EditorModule<Id> {
  return editorModule;
}

export { bindCommands } from "@/commands/define";
