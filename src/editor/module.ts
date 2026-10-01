import type { HintSection } from "@/commands/hints";
import type { CommandRegistry } from "@/commands/types";
import type { SpriteDocument } from "@/core/document";
import type { Command, History } from "@/core/history";
import type { CanvasRenderer } from "@/core/renderer";
import type { ToolHost } from "@/framework/host";
import type { ToolId } from "@/tools";

/** What the shell hands every module's `commands`: the open document and app-level actions. */
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

/** One host domain's contributions to the editor; the shell and canvas read them from `EDITOR_MODULES`. */
export interface EditorModule {
  readonly id: string;
  /** Plain function: called per render by the shell; closures read stores lazily. */
  commands?(ctx: ModuleContext): CommandRegistry;
  /** Inputs owned by the module rather than a command; each joins the command group it names. */
  readonly hints?: readonly HintSection[];
  /** Registers painters or listeners on the renderer; the cleanup runs when it is disposed. */
  attachCanvas?(renderer: CanvasRenderer, doc: SpriteDocument): () => void;
  /** The module store's `subscribe`: bound controls re-read command state when it changes. */
  subscribe?(listener: () => void): () => void;
}
