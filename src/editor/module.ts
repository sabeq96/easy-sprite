import type { HintSection } from "@/commands/hints";
import type { CommandHold, CommandId, CommandRegistry } from "@/commands/types";
import type { CommandGroup } from "@/constants/commands";
import type { SpriteDocument } from "@/core/document";
import type { Command, History } from "@/core/history";
import type { CanvasRenderer } from "@/core/renderer";
import type { ToolHost } from "@/framework/host";
import type { KeyBinding } from "@/lib/keys";
import type { ToolId } from "@/tools";

/** What the shell hands every module command: the open document and app-level actions. */
export interface ModuleContext {
  readonly doc: SpriteDocument;
  readonly history: History;
  /** Runs a command factory and records the command for undo; false when it was a no-op. */
  dispatch(factory: () => Command | null): boolean;
  navigate(to: string): void;
  showHelp(): void;
  /** Writes every pending change to the database now. */
  save(): Promise<void>;
  /** The open document's tool host as `toolId` sees it; tool-contributed commands run through it. */
  forTool(toolId: ToolId): ToolHost;
}

/**
 * One command a module declares, with its keys, the same shape as `Tool.commands`. The shell binds
 * it to the open document's `ModuleContext`; handlers read the module's store when they run.
 */
export interface ModuleCommand<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly group: CommandGroup;
  /** The chords that run this command; the active registry is the keymap. */
  readonly keys?: readonly KeyBinding[];
  isEnabled?(ctx: ModuleContext): boolean;
  isActive?(ctx: ModuleContext): boolean;
  run(ctx: ModuleContext): void;
  /** A key bound to this command reports its press and release here instead of calling `run`. */
  hold?(ctx: ModuleContext): CommandHold;
}

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
export function defineCommands<const Id extends string>(
  commands: readonly ModuleCommand<Id>[],
): readonly ModuleCommand<Id>[] {
  return commands;
}

/** Keeps the module's command ids literal, so `ModuleCommandId` can be derived from the list. */
export function defineModule<Id extends string = never>(
  editorModule: EditorModule<Id>,
): EditorModule<Id> {
  return editorModule;
}

/** The registry entries for `commands`, each bound to the open document's context, in order. */
export function bindCommands(
  commands: readonly ModuleCommand[],
  ctx: ModuleContext,
): CommandRegistry {
  const registry: CommandRegistry = {};
  for (const command of commands) {
    // Every module command id is part of `CommandId`, which is derived from these definitions.
    const id = command.id as CommandId;
    registry[id] = {
      id,
      label: command.label,
      group: command.group,
      keys: command.keys,
      isEnabled: command.isEnabled && (() => command.isEnabled?.(ctx) ?? true),
      isActive: command.isActive && (() => command.isActive?.(ctx) ?? false),
      run: () => command.run(ctx),
      hold: command.hold?.(ctx),
    };
  }
  return registry;
}
