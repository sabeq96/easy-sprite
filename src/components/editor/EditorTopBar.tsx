import { ArrowLeft, Redo2, Undo2 } from "lucide-react";
import { Link } from "react-router";
import { useDocumentSession } from "@/app/DocumentProvider";
import { SaveStatusBadge } from "@/components/editor/SaveStatusBadge";
import { SpriteNameField } from "@/components/editor/SpriteNameField";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { ROUTES } from "@/constants/routes";
import { useHistoryState } from "@/hooks/useHistoryState";

export function EditorTopBar() {
  const { history, saveStatus } = useDocumentSession();
  const { canUndo, canRedo, undoLabel, redoLabel } = useHistoryState(history);

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

      <SpriteNameField />
      <Separator orientation="vertical" className="h-5" />

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={() => history.undo()}
            >
              <Undo2 />
            </Button>
          }
        />
        <TooltipContent>
          {undoLabel ? `Undo ${undoLabel.toLowerCase()}` : "Undo"} <Kbd>⌘Z</Kbd>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={() => history.redo()}
            >
              <Redo2 />
            </Button>
          }
        />
        <TooltipContent>
          {redoLabel ? `Redo ${redoLabel.toLowerCase()}` : "Redo"} <Kbd>⌘⇧Z</Kbd>
        </TooltipContent>
      </Tooltip>

      <div className="ml-auto">
        <SaveStatusBadge status={saveStatus} />
      </div>
    </header>
  );
}
