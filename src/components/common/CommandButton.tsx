import { TooltipButton, type TooltipButtonProps } from "@/components/common/TooltipButton";
import { useCommand, useCommandKeys, useCommandState } from "@/commands/CommandsContext";
import type { CommandId } from "@/commands/types";

export interface CommandButtonProps extends Omit<TooltipButtonProps, "label" | "shortcut"> {
  command: CommandId;
  /** Overrides the registry label, e.g. "Undo stroke". */
  label?: string;
  /** Overrides the keys shown; defaults to every binding of the command. */
  keys?: readonly string[];
}

/**
 * A button bound to a command: its label, every key, enabled/active state and action come from
 * the registry, so a button can never show a stale or missing shortcut.
 *
 * The enabled and active state follow the stores the `CommandsProvider` subscribes to; state
 * outside them (the document, the undo history) needs a parent that passes `disabled`. Pass
 * `onClick` only when the button acts on something other than the active target (a specific
 * frame card); the keys shown are still the command's.
 */
export function CommandButton({
  command: id,
  label,
  keys,
  disabled,
  onClick,
  variant,
  ...props
}: CommandButtonProps) {
  const command = useCommand(id);
  const { isActive, isEnabled } = useCommandState(id);
  const commandKeys = useCommandKeys(id);
  const toggles = command.isActive !== undefined;

  return (
    <TooltipButton
      label={label ?? command.label}
      shortcut={keys ?? commandKeys}
      disabled={disabled ?? !isEnabled}
      aria-pressed={toggles ? isActive : undefined}
      variant={variant ?? (isActive ? "secondary" : "ghost")}
      onClick={onClick ?? (() => command.run())}
      {...props}
    />
  );
}
