import { useState } from "react";
import { ArrowLeft, Download, Keyboard, Redo2, Undo2 } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
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
import { downloadSpritePng } from "@/export/spritePng";
import { useHistoryState } from "@/hooks/useHistoryState";

export function EditorTopBar() {
  const { doc, history, autosave, saveStatus } = useDocumentSession();
  const { canUndo, canRedo, undoLabel, redoLabel } = useHistoryState(history);
  const [isExporting, setExporting] = useState(false);

  const exportSprite = async () => {
    setExporting(true);
    try {
      // Flush pending autosave so the PNG always matches what is on screen.
      await autosave.flush();
      const filename = await downloadSpritePng(doc);
      toast.success(`Exported ${filename}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

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

        <Button size="sm" onClick={() => void exportSprite()} disabled={isExporting}>
          <Download />
          Export
        </Button>

        <SaveStatusBadge status={saveStatus} />
      </div>
    </Panel>
  );
}
