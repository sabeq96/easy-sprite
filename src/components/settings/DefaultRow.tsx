import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { TooltipButton } from "@/components/common/TooltipButton";

export interface DefaultRowProps {
  label: string;
  /** Whether any value in the group differs from its built-in; enables the reset button. */
  changed: boolean;
  onReset: () => void;
  children: ReactNode;
}

/** One group of defaults, with a button that puts the whole group back to its built-in values. */
export function DefaultRow({ label, changed, onReset, children }: DefaultRowProps) {
  return (
    <section aria-label={label} className="flex items-start gap-3 border-t pt-3 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h3 className="text-sm font-medium">{label}</h3>
        {children}
      </div>
      <TooltipButton
        label={`Reset ${label.toLowerCase()} to default`}
        size="icon-sm"
        variant="ghost"
        disabled={!changed}
        onClick={onReset}
      >
        <RotateCcw />
      </TooltipButton>
    </section>
  );
}
