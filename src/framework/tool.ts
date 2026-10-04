import type { Hint } from "@/commands/hints";
import type { Point } from "@/core/viewport";
import type { ContributedCommand } from "@/framework/command";
import type { Gesture, ToolHost } from "@/framework/host";
import type { ChoiceKey, Settings } from "@/framework/settings";
import type { KeyBinding } from "@/lib/keys";
import type { LucideIcon } from "lucide-react";

/** Integer sprite-space pixel. */
export type ToolPoint = Point;

/** Sidebar section; the order within a section is the order of `TOOL_LIST`. */
export type ToolGroup = "draw" | "color" | "select";

export interface Tool<
  Id extends string = string,
  C extends readonly ContributedCommand[] = readonly ContributedCommand[],
  S extends Settings = Settings,
> {
  readonly id: Id;
  readonly label: string;
  /** Drawn on the tool's sidebar button. */
  readonly icon: LucideIcon;
  readonly group: ToolGroup;
  /** The binding that activates the tool; merged into the keymap as `tool.<id>`. */
  readonly shortcut?: KeyBinding;
  /**
   * The choice setting that pressing the tool's key again steps (wrapping), while the tool is
   * already active and no hold is running. `defineTool` checks that it names a choice in
   * `settings`; it is a plain string here so every tool still fits the wide `Tool` type.
   */
  readonly reselect?: string;
  /**
   * Gestures worth teaching in Keyboard shortcuts — only the non-obvious ones (a modifier, a
   * special zone); "drag to draw" goes without saying. Keep it honest with the handlers.
   */
  readonly hints?: readonly Hint[];
  /**
   * Commands this tool owns, with their keys. The host registers them bound to this tool's host,
   * and Keyboard shortcuts lists them in the tool's section rather than their group.
   */
  readonly commands?: C;
  /** Whether a drag continues the operation (pencil) or is a one-shot (bucket). */
  readonly continuous: boolean;
  /**
   * What the user can set on this tool, as data. The host stores the values, renders the options
   * bar from them, and generates any declared command; the tool reads them through
   * `host.tool.settings()`. Nothing else can see them, so declare only what the tool reads.
   */
  readonly settings?: S;

  onPointerDown(host: ToolHost<S>, gesture: Gesture): void;
  onPointerMove?(host: ToolHost<S>, gesture: Gesture): void;
  onPointerUp?(host: ToolHost<S>, gesture: Gesture): void;

  /**
   * Runs when the tool becomes active; the returned cleanup runs when it stops being active
   * (tool switch, held-key swap, editor unmount). Anything a tool remembers between gestures
   * lives between these two calls and is reset by the cleanup — so no other tool, slice or hook
   * can ever observe it.
   */
  onActivate?(host: ToolHost<S>): () => void;
  /** Hover with no button held (`null` = pointer left). Returns a CSS cursor, or null for the default. */
  onHover?(host: ToolHost<S>, point: ToolPoint | null): string | null;
}

/**
 * Keeps the literal id, command ids and settings, so `ToolId`, `ContributedCommandId` and
 * `SettingCommandId` can be derived from the registry, and `host.tool.settings()` is typed.
 */
export function defineTool<
  const Id extends string,
  const C extends readonly ContributedCommand[] = readonly [],
  const S extends Settings = Record<never, never>,
>(tool: Tool<Id, C, S> & { readonly reselect?: ChoiceKey<S> }): Tool<Id, C, S> {
  return tool;
}
