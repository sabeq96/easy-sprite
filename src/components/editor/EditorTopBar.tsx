import { ArrowLeft, Keyboard, Redo2, Undo2 } from "lucide-react";
import { Link } from "react-router";
import { useDocumentSession } from "@/app/DocumentProvider";
import { TooltipButton } from "@/components/common/TooltipButton";
import { EditorMenu } from "@/components/editor/EditorMenu";
import { SaveStatusBadge } from "@/components/editor/SaveStatusBadge";
import { SpriteNameField } from "@/components/editor/SpriteNameField";
import { ViewControls } from "@/components/editor/ViewControls";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ROUTES } from "@/constants/routes";
import { useHistoryState } from "@/hooks/useHistoryState";
import { IS_APPLE } from "@/lib/keys";

export interface EditorTopBarProps {
  onShowHelp: () => void;
}

export function EditorTopBar({ onShowHelp }: EditorTopBarProps) {
  const { history, saveStatus } = useDocumentSession();
  const { canUndo, canRedo, undoLabel, redoLabel } = useHistoryState(history);
  const mod = IS_APPLE ? "⌘" : "Ctrl+";

  return (
    <header className="flex items-center gap-2 border-b px-2">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Back to sprites"
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
        shortcut={`${mod}Z`}
        disabled={!canUndo}
        onClick={() => history.undo()}
      >
        <Undo2 />
      </TooltipButton>

      <TooltipButton
        label={redoLabel ? `Redo ${redoLabel.toLowerCase()}` : "Redo"}
        shortcut={`${mod}⇧Z`}
        disabled={!canRedo}
        onClick={() => history.redo()}
      >
        <Redo2 />
      </TooltipButton>

      <div className="ml-auto flex items-center gap-2">
        <ViewControls />

        <TooltipButton label="Keyboard shortcuts" shortcut="?" onClick={onShowHelp}>
          <Keyboard />
        </TooltipButton>

        <Separator orientation="vertical" className="h-5" />
        <SaveStatusBadge status={saveStatus} />
      </div>
    </header>
  );
}
