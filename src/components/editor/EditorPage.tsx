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
import { CommandsProvider } from "@/commands/CommandsContext";
import { useEditorCommands } from "@/commands/useEditorCommands";
import { useActiveTargets } from "@/hooks/useActiveTargets";
import { useColorHotkeys } from "@/hooks/useColorHotkeys";
import { useGridDefaults } from "@/hooks/useGridDefaults";
import { useHeldToolKeys } from "@/hooks/useHeldToolKeys";
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
  useColorHotkeys();
  useGridDefaults();
  useHeldToolKeys();

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
    <CommandsProvider value={withHelp}>
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

        <ShortcutHelpDialog commands={withHelp} open={showHelp} onOpenChange={setShowHelp} />
      </div>
    </CommandsProvider>
  );
}
