import type { Hint } from "@/commands/hints";
import type { AppCommandId } from "@/constants/commands";
import type { Point } from "@/core/viewport";
import type { ContributedCommand } from "@/framework/command";
import type { Gesture, ToolHost } from "@/framework/host";
import type { KeyBinding } from "@/lib/keys";
import type { LucideIcon } from "lucide-react";

/** Integer sprite-space pixel. */
export type ToolPoint = Point;

/**
 * The option groups a tool can support. A tool declares these on itself (see `Tool.options`),
 * and both the options bar and the brush preview read that declaration — so an option can never
 * be offered or previewed by a surface that the tool itself ignores.
 */
export type ToolOptionField = "brushSize" | "mirror" | "pickSource";

/** Sidebar section; the order within a section is the order of `TOOL_LIST`. */
export type ToolGroup = "draw" | "color" | "select";

export interface Tool<
  Id extends string = string,
  C extends readonly ContributedCommand[] = readonly ContributedCommand[],
> {
  readonly id: Id;
  readonly label: string;
  /** Drawn on the tool's sidebar button. */
  readonly icon: LucideIcon;
  readonly group: ToolGroup;
  /** The binding that activates the tool; merged into the keymap as `tool.<id>`. */
  readonly shortcut?: KeyBinding;
  /** Run when the tool's key is pressed while it is already active and no hold is running. */
  readonly reselectCommand?: AppCommandId;
  /**
   * Gestures worth teaching in the shortcut sheet — only the non-obvious ones (a modifier, a
   * special zone); "drag to draw" goes without saying. Keep it honest with the handlers.
   */
  readonly hints?: readonly Hint[];
  /**
   * Commands this tool owns, with their keys. The host registers them bound to this tool's host,
   * and the sheet lists them in the tool's section rather than their group.
   */
  readonly commands?: C;
  /** Whether a drag continues the operation (pencil) or is a one-shot (bucket). */
  readonly continuous: boolean;
  /**
   * The options this tool actually reads from `host.tool.options()`. Declaring one it ignores is
   * what put an inert Mirror toggle (and its mirrored brush preview) on the eraser, so keep this
   * list honest: it is the only thing the UI consults.
   */
  readonly options: readonly ToolOptionField[];

  onPointerDown(host: ToolHost, gesture: Gesture): void;
  onPointerMove?(host: ToolHost, gesture: Gesture): void;
  onPointerUp?(host: ToolHost, gesture: Gesture): void;

  /**
   * Runs when the tool becomes active; the returned cleanup runs when it stops being active
   * (tool switch, held-key swap, editor unmount). Anything a tool remembers between gestures
   * lives between these two calls and is reset by the cleanup — so no other tool, slice or hook
   * can ever observe it.
   */
  onActivate?(host: ToolHost): () => void;
  /** Hover with no button held (`null` = pointer left). Returns a CSS cursor, or null for the default. */
  onHover?(host: ToolHost, point: ToolPoint | null): string | null;
}

/**
 * Keeps the literal id and command ids, so `ToolId` and `ContributedCommandId` can be derived
 * from the registry.
 */
export function defineTool<
  const Id extends string,
  const C extends readonly ContributedCommand[] = readonly [],
>(tool: Tool<Id, C>): Tool<Id, C> {
  return tool;
}
