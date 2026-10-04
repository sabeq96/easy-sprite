import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { DocumentProvider, useDocumentSession } from "@/app/DocumentProvider";
import { NotFoundPage } from "@/components/common/NotFoundPage";
import { CommandsProvider } from "@/commands/CommandsContext";
import { createToolHost, EditorCanvas, ToolHostProvider } from "@/editor/canvas/api";
import { FramesBar, useActiveFrameGuard } from "@/editor/frames/api";
import { useActiveLayerGuard } from "@/editor/layers/api";
import { bindEditorCommands, EDITOR_MODULES, subscribeToModules } from "@/editor/modules";
import { useOnionReset } from "@/editor/animation/api";
import { useColorHotkeys, usePaletteReset } from "@/editor/palette/api";
import { ToolOptionsBar, ToolSidebar } from "@/editor/toolbox/api";
import { useGridReset } from "@/editor/view/api";
import { useShortcuts } from "@/hooks/useShortcuts";
import { EditorLoadError } from "./EditorLoadError";
import { EditorSkeleton } from "./EditorSkeleton";
import { EditorStatusBar } from "./EditorStatusBar";
import { EditorTopBar } from "./EditorTopBar";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { RightSidebar } from "./RightSidebar";
import { useModuleContext } from "./useModuleContext";

export function EditorPage() {
  const { spriteId } = useParams<{ spriteId: string }>();
  if (!spriteId) return <NotFoundPage />;

  return (
    <DocumentProvider
      spriteId={spriteId}
      fallback={<EditorSkeleton />}
      renderError={(message) => <EditorLoadError message={message} />}
    >
      <EditorToolHost>
        <EditorShell />
      </EditorToolHost>
    </DocumentProvider>
  );
}

/** One tool host per open document, shared by the shell's commands and the canvas's gestures. */
function EditorToolHost({ children }: { children: ReactNode }) {
  const { doc, history } = useDocumentSession();
  // Identity is load-bearing: tools and the renderer binding hold on to this host.
  const host = useMemo(() => createToolHost({ doc, history }), [doc, history]);
  return <ToolHostProvider value={host}>{children}</ToolHostProvider>;
}

/** Layout and wiring only — every panel owns its own state and subscriptions. */
function EditorShell() {
  const [showHelp, setShowHelp] = useState(false);

  useActiveLayerGuard();
  useActiveFrameGuard();
  useColorHotkeys();
  useGridReset();
  useOnionReset();
  usePaletteReset();

  const ctx = useModuleContext(() => setShowHelp(true));
  const commands = bindEditorCommands(ctx);
  useShortcuts(commands);

  return (
    <CommandsProvider value={{ registry: commands, subscribe: subscribeToModules }}>
      <div className="grid h-dvh grid-cols-1 grid-rows-[auto_auto_1fr_auto_auto] gap-2 overflow-hidden bg-background p-2">
        <EditorTopBar />
        <ToolOptionsBar />
        <div className="grid min-h-0 grid-cols-[3.5rem_1fr_18rem] gap-2">
          <ToolSidebar />
          <EditorCanvas modules={EDITOR_MODULES} />
          <RightSidebar />
        </div>
        <FramesBar />
        <EditorStatusBar />

        <KeyboardShortcutsDialog commands={commands} open={showHelp} onOpenChange={setShowHelp} />
      </div>
    </CommandsProvider>
  );
}
