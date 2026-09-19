import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface TooltipButtonProps extends ComponentProps<typeof Button> {
  /** Tooltip text; also the accessible name for these icon-only buttons. */
  label: string;
  shortcut?: string;
  side?: ComponentProps<typeof TooltipContent>["side"];
  /** Optional: a `render` element supplies its own content, as the back-links in the bars do. */
  children?: ReactNode;
}

/**
 * An icon button with a tooltip.
 *
 * The trigger renders a plain wrapper and the Button stays a real child, because Base UI's
 * Tooltip.Trigger injects its own `onClick` when it renders your element — which silently
 * replaces the handler and leaves the button dead. Keeping them separate is the only
 * arrangement where both the tooltip and the click work.
 */
export function TooltipButton({
  label,
  shortcut,
  side = "bottom",
  children,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: TooltipButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Button aria-label={label} variant={variant} size={size} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}
