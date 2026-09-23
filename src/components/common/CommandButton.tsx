import { TooltipButton, type TooltipButtonProps } from "@/components/common/TooltipButton";
import { useCommand } from "@/commands/CommandsContext";
import type { CommandId } from "@/commands/types";
import { commandKeys } from "@/commands/keymap";
import { useEditorStore } from "@/stores/useEditorStore";

export interface CommandButtonProps extends Omit<TooltipButtonProps, "label" | "shortcut"> {
  command: CommandId;
  /** Overrides the registry label, e.g. "Undo stroke". */
  label?: string;
  /** Non-binding hints shown after the keys, e.g. "Hold ⌥". */
  extraShortcuts?: readonly string[];
}

/**
 * A button bound to a command: its label, every key, enabled/active state and action come from
 * the registry, so a button can never show a stale or missing shortcut.
 *
 * `isEnabled` is read at render — parents already re-render on the state it reads, or pass
 * `disabled` themselves. Pass `onClick` only when the button acts on something other than the
 * active target (a specific frame card); the keys shown are still the command's.
 */
export function CommandButton({
  command: id,
  label,
  extraShortcuts = [],
  disabled,
  onClick,
  variant,
  ...props
}: CommandButtonProps) {
  const command = useCommand(id);
  // isActive reads the store, so running it as a selector keeps the pressed state live.
  const isActive = useEditorStore(() => command.isActive?.() ?? false);
  const toggles = command.isActive !== undefined;

  return (
    <TooltipButton
      label={label ?? command.label}
      shortcut={[...commandKeys(id), ...extraShortcuts]}
      disabled={disabled ?? command.isEnabled?.() === false}
      aria-pressed={toggles ? isActive : undefined}
      variant={variant ?? (isActive ? "secondary" : "ghost")}
      onClick={onClick ?? (() => command.run())}
      {...props}
    />
  );
}
