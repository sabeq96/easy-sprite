import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { DocumentProvider, useDocumentSession } from "@/app/DocumentProvider";
import { NotFoundPage } from "@/components/common/NotFoundPage";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { FramesBar } from "@/components/editor/FramesBar";
import { ToolOptionsBar } from "@/components/editor/ToolOptionsBar";
import { ToolSidebar } from "@/components/editor/ToolSidebar";
import { CommandsProvider } from "@/commands/CommandsContext";
import type { CommandRegistry } from "@/commands/types";
import { useEditorCommands } from "@/commands/useEditorCommands";
import { useActiveLayerGuard } from "@/editor/layers/api";
import { EDITOR_MODULES } from "@/editor/modules";
import { useColorHotkeys } from "@/editor/palette/api";
import { useActiveTargets } from "@/hooks/useActiveTargets";
import { useGridDefaults } from "@/hooks/useGridDefaults";
import { useShortcuts } from "@/hooks/useShortcuts";
import { createToolHost } from "@/hooks/toolHost/createToolHost";
import { ToolHostProvider } from "@/hooks/toolHost/ToolHostContext";
import { EditorLoadError } from "./EditorLoadError";
import { EditorSkeleton } from "./EditorSkeleton";
import { EditorStatusBar } from "./EditorStatusBar";
import { EditorTopBar } from "./EditorTopBar";
import { RightSidebar } from "./RightSidebar";
import { ShortcutHelpDialog } from "./ShortcutHelpDialog";
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
  useActiveTargets();
  useColorHotkeys();
  useGridDefaults();

  const ctx = useModuleContext(() => setShowHelp(true));
  const notYetInModules = useEditorCommands();
  const commands = mergeCommands([
    ...EDITOR_MODULES.map((editorModule) => editorModule.commands?.(ctx) ?? {}),
    notYetInModules,
  ]);
  useShortcuts(commands);

  return (
    <CommandsProvider value={commands}>
      <div className="grid h-dvh grid-cols-1 grid-rows-[auto_auto_1fr_auto_auto] gap-2 overflow-hidden bg-background p-2">
        <EditorTopBar />
        <ToolOptionsBar />
        <div className="grid min-h-0 grid-cols-[3.5rem_1fr_18rem] gap-2">
          <ToolSidebar />
          <EditorCanvas />
          <RightSidebar />
        </div>
        <FramesBar />
        <EditorStatusBar />

        <ShortcutHelpDialog commands={commands} open={showHelp} onOpenChange={setShowHelp} />
      </div>
    </CommandsProvider>
  );
}

/** Every module's commands plus those not yet moved into a module, as one registry. */
function mergeCommands(registries: readonly CommandRegistry[]): CommandRegistry {
  return Object.assign({}, ...registries) as CommandRegistry;
}
