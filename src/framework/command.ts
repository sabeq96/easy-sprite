import type { CommandGroup } from "@/constants/commands";
import type { ToolHost } from "@/framework/host";
import type { KeyBinding } from "@/lib/keys";

/**
 * A command a tool owns outright: its id, wording, keys and behaviour. The host merges these
 * into the command registry and the keymap, bound to the tool's host.
 */
export interface ContributedCommand<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly group: CommandGroup;
  readonly keys?: readonly KeyBinding[];
  isEnabled?(host: ToolHost): boolean;
  isActive?(host: ToolHost): boolean;
  run(host: ToolHost): void;
}
