import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useApplyTheme } from "@/hooks/useTheme";

export function AppProviders({ children }: { children: ReactNode }) {
  // App-level, not layout-level: the editor route renders outside the shell.
  useApplyTheme();

  return (
    <TooltipProvider>
      {children}
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
