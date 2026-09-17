import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { DocumentProvider } from "@/app/DocumentProvider";
import { NotFoundPage } from "@/components/common/NotFoundPage";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { EditorLoadError } from "@/components/editor/EditorLoadError";
import { EditorSkeleton } from "@/components/editor/EditorSkeleton";
import { EditorStatusBar } from "@/components/editor/EditorStatusBar";
import { EditorTopBar } from "@/components/editor/EditorTopBar";
import { FramesBar } from "@/components/editor/FramesBar";
import { RightSidebar } from "@/components/editor/RightSidebar";
import { ShortcutHelpDialog } from "@/components/editor/ShortcutHelpDialog";
import { ToolOptionsBar } from "@/components/editor/ToolOptionsBar";
import { ToolSidebar } from "@/components/editor/ToolSidebar";
import { useEditorCommands } from "@/commands/useEditorCommands";
import { useActiveTargets } from "@/hooks/useActiveTargets";
import { useColorHotkeys } from "@/hooks/useColorHotkeys";
import { useSelectionLifecycle } from "@/hooks/useSelectionLifecycle";
import { useShortcuts } from "@/hooks/useShortcuts";

export function EditorPage() {
  const { spriteId } = useParams<{ spriteId: string }>();
  if (!spriteId) return <NotFoundPage />;

  return (
    <DocumentProvider
      spriteId={spriteId}
      fallback={<EditorSkeleton />}
      renderError={(message) => <EditorLoadError message={message} />}
    >
      <EditorShell />
    </DocumentProvider>
  );
}

/** Layout and wiring only — every panel owns its own state and subscriptions. */
function EditorShell() {
  const [showHelp, setShowHelp] = useState(false);

  useActiveTargets();
  useSelectionLifecycle();
  useColorHotkeys();

  const commands = useEditorCommands();
  // The help dialog is a shell concern, so it is injected rather than living in the registry.
  const withHelp = useMemo(
    () => ({
      ...commands,
      "app.shortcutHelp": {
        id: "app.shortcutHelp" as const,
        label: "Keyboard shortcuts",
        group: "App" as const,
        run: () => setShowHelp(true),
      },
    }),
    [commands],
  );

  useShortcuts(withHelp);

  return (
    <div className="grid h-dvh grid-rows-[2.5rem_2.25rem_1fr_auto_1.75rem] overflow-hidden">
      <EditorTopBar onShowHelp={() => setShowHelp(true)} />
      <ToolOptionsBar />
      <div className="grid min-h-0 grid-cols-[3rem_1fr_18rem]">
        <ToolSidebar />
        <EditorCanvas />
        <RightSidebar />
      </div>
      <FramesBar />
      <EditorStatusBar />

      <ShortcutHelpDialog commands={withHelp} open={showHelp} onOpenChange={setShowHelp} />
    </div>
  );
}
