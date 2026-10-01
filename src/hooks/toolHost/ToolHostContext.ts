import { createContext, useContext } from "react";
import type { DocumentToolHost } from "@/hooks/toolHost/createToolHost";

const ToolHostContext = createContext<DocumentToolHost | null>(null);

/**
 * Provided once per open document by the editor shell, so commands (in the shell) and gestures
 * (in the canvas) share one host.
 */
export const ToolHostProvider = ToolHostContext;

export function useToolHost(): DocumentToolHost {
  const host = useContext(ToolHostContext);
  if (!host) throw new Error("useToolHost needs a ToolHostProvider above it");
  return host;
}
