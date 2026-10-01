import { useNavigate } from "react-router";
import { useDocumentSession } from "@/app/DocumentProvider";
import { useToolHost } from "@/editor/canvas/api";
import type { ModuleContext } from "@/editor/module";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";

/** The context every module's `commands` receives, built from the open document's session. */
export function useModuleContext(showHelp: () => void): ModuleContext {
  const { doc, history, autosave } = useDocumentSession();
  const dispatch = useCommandDispatch();
  const navigate = useNavigate();
  const toolHost = useToolHost();

  return {
    doc,
    history,
    dispatch,
    navigate: (to) => void navigate(to),
    showHelp,
    save: () => autosave.flush(),
    forTool: (toolId) => toolHost.forTool(toolId),
  };
}
