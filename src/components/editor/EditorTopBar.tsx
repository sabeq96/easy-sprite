import { useState } from "react";
import { ArrowLeft, Download, Keyboard, Redo2, Undo2 } from "lucide-react";
import { Link } from "react-router";
import { useDocumentSession } from "@/app/DocumentProvider";
import { Panel } from "@/components/common/Panel";
import { SaveStatusBadge } from "@/components/common/SaveStatusBadge";
import { TooltipButton } from "@/components/common/TooltipButton";
import { EditorMenu } from "@/components/editor/EditorMenu";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { SpriteNameField } from "@/components/editor/SpriteNameField";
import { ViewControls } from "@/components/editor/ViewControls";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ROUTES } from "@/constants/routes";
import { shortcutHint } from "@/constants/shortcuts";
import { useHistoryState } from "@/hooks/useHistoryState";

export interface EditorTopBarProps {
  onShowHelp: () => void;
}

export function EditorTopBar({ onShowHelp }: EditorTopBarProps) {
  const { doc, history, autosave, saveStatus } = useDocumentSession();
  const { canUndo, canRedo, undoLabel, redoLabel } = useHistoryState(history);
  const [isExporting, setExporting] = useState(false);

  return (
    <Panel render={<header />} className="flex items-center gap-2 px-2 py-1.5">
      <TooltipButton
        label="Back to sprites"
        shortcut={shortcutHint("app.backToLibrary")}
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

      <TooltipButton
        label={undoLabel ? `Undo ${undoLabel.toLowerCase()}` : "Undo"}
        shortcut={shortcutHint("edit.undo")}
        disabled={!canUndo}
        onClick={() => history.undo()}
      >
        <Undo2 />
      </TooltipButton>

      <TooltipButton
        label={redoLabel ? `Redo ${redoLabel.toLowerCase()}` : "Redo"}
        shortcut={shortcutHint("edit.redo")}
        disabled={!canRedo}
        onClick={() => history.redo()}
      >
        <Redo2 />
      </TooltipButton>

      <div className="ml-auto flex items-center gap-2">
        <ViewControls />

        <TooltipButton
          label="Keyboard shortcuts"
          shortcut={shortcutHint("app.shortcutHelp")}
          onClick={onShowHelp}
        >
          <Keyboard />
        </TooltipButton>

        <Separator orientation="vertical" className="h-5" />

        <Button size="sm" onClick={() => setExporting(true)}>
          <Download />
          Export
        </Button>

        <SaveStatusBadge status={saveStatus} />
      </div>

      <ExportDialog
        doc={doc}
        open={isExporting}
        onOpenChange={setExporting}
        onBeforeExport={() => autosave.flush()}
      />
    </Panel>
  );
}
