import { ArrowLeft, Download, Keyboard, Redo2, Undo2 } from "lucide-react";
import { Link } from "react-router";
import { useDocumentSession } from "@/app/DocumentProvider";
import { CommandButton } from "@/components/common/CommandButton";
import { Panel } from "@/components/common/Panel";
import { SaveStatusBadge } from "@/components/common/SaveStatusBadge";
import { TooltipButton } from "@/components/common/TooltipButton";
import { EditorMenu } from "@/components/editor/EditorMenu";
import { SpriteNameField } from "@/components/editor/SpriteNameField";
import { ViewControls } from "@/components/editor/ViewControls";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ROUTES } from "@/constants/routes";
import { commandKeys } from "@/commands/keymap";
import { useHistoryState } from "@/hooks/useHistoryState";
import { useSpriteExport } from "@/hooks/useSpriteActions";

export function EditorTopBar() {
  const { doc, history, autosave, saveStatus } = useDocumentSession();
  const { canUndo, canRedo, undoLabel, redoLabel } = useHistoryState(history);
  const exportPng = useSpriteExport();

  return (
    <Panel render={<header />} className="flex items-center gap-2 px-2 py-1.5">
      {/* A link, not a command button: navigation belongs to the <Link>. */}
      <TooltipButton
        label="Back to sprites"
        shortcut={commandKeys("app.backToLibrary")}
        size="icon-sm"
        variant="ghost"
        nativeButton={false}
        render={
          <Link to={ROUTES.sprites}>
            <ArrowLeft />
          </Link>
        }
      />

      <EditorMenu />
      <SpriteNameField />
      <Separator orientation="vertical" className="h-5" />

      <CommandButton
        command="edit.undo"
        label={undoLabel ? `Undo ${undoLabel.toLowerCase()}` : undefined}
        disabled={!canUndo}
      >
        <Undo2 />
      </CommandButton>

      <CommandButton
        command="edit.redo"
        label={redoLabel ? `Redo ${redoLabel.toLowerCase()}` : undefined}
        disabled={!canRedo}
      >
        <Redo2 />
      </CommandButton>

      <div className="ml-auto flex items-center gap-2">
        <ViewControls />

        <CommandButton command="app.shortcutHelp">
          <Keyboard />
        </CommandButton>

        <Separator orientation="vertical" className="h-5" />

        <Button
          size="sm"
          // Flush pending autosave first, so the PNG always matches what is on screen.
          onClick={() => void exportPng.run(doc, () => autosave.flush())}
          disabled={exportPng.isRunning}
        >
          <Download />
          Export
        </Button>

        <SaveStatusBadge status={saveStatus} />
      </div>
    </Panel>
  );
}
