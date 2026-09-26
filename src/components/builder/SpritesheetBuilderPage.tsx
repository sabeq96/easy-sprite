import { ArrowLeft, Download, Keyboard, Redo2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { BuilderBlockPreview } from "@/components/builder/BuilderBlock";
import { BuilderCanvas } from "@/components/builder/BuilderCanvas";
import { BuilderPalette, SpriteTilePreview } from "@/components/builder/BuilderPalette";
import { SpritesheetMenu } from "@/components/builder/SpritesheetMenu";
import { SpritesheetProvider, useSpritesheetSession } from "@/app/SpritesheetProvider";
import { BuilderStatusBar } from "@/components/builder/BuilderStatusBar";
import { BuilderViewControls } from "@/components/builder/BuilderViewControls";
import { CommandButton } from "@/components/common/CommandButton";
import { DragBoard } from "@/components/common/DragBoard";
import { InlineNameField } from "@/components/common/InlineNameField";
import { NotFoundPage } from "@/components/common/NotFoundPage";
import { Panel } from "@/components/common/Panel";
import { SaveStatusBadge } from "@/components/common/SaveStatusBadge";
import { ShortcutHelpDialog } from "@/components/common/ShortcutHelpDialog";
import { TooltipButton } from "@/components/common/TooltipButton";
import { Button } from "@/components/ui/button";
import { CommandsProvider } from "@/commands/CommandsContext";
import { commandKeys } from "@/commands/keymap";
import { useBuilderCommands } from "@/commands/useBuilderCommands";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { useBuilderDnd, type DragData } from "@/hooks/useBuilderDnd";
import { BUILDER_VIEW_HINTS } from "@/hooks/useBuilderViewport";
import { useHistoryState } from "@/hooks/useHistoryState";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useSpriteSizes } from "@/hooks/useSpriteSizes";
import { useSpritesheetExport } from "@/hooks/useSpritesheetActions";
import { useSpritesheetSnapshot } from "@/hooks/useSpritesheetSnapshot";
import { packSheet } from "@/lib/sheetLayout";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";

export function SpritesheetBuilderPage() {
  const { spritesheetId } = useParams<{ spritesheetId: string }>();
  if (!spritesheetId) return <NotFoundPage />;
  return (
    <SpritesheetProvider
      spritesheetId={spritesheetId}
      fallback={<BuilderSkeleton />}
      notFound={<NotFoundPage />}
    >
      <SpritesheetBuilderShell />
    </SpritesheetProvider>
  );
}

function SpritesheetBuilderShell() {
  const { doc, history, saveStatus } = useSpritesheetSession();
  const { name, tileSize } = useSpritesheetSnapshot(doc);
  const { canUndo, canRedo, undoLabel, redoLabel } = useHistoryState(history);
  const exportSheet = useSpritesheetExport();
  const sizes = useSpriteSizes();
  const dnd = useBuilderDnd(doc, history, sizes);
  const { docs } = dnd;

  const sheet = packSheet(dnd.blocks, sizes);

  const [showHelp, setShowHelp] = useState(false);
  const commands = useBuilderCommands(sheet, () => setShowHelp(true));
  useShortcuts(commands);

  // Grid to one tile, chessboard to one pixel, each time a sheet opens.
  const resetGrid = useBuilderViewStore((state) => state.resetGrid);
  useEffect(() => resetGrid(tileSize), [doc, tileSize, resetGrid]);
  const placedSpriteIds = new Set(dnd.blocks.map((block) => block.spriteId));

  const renderPreview = (data: DragData) => {
    if (data.type === "palette") {
      return <SpriteTilePreview name={data.name} thumbnail={data.thumbnail} />;
    }
    const block = dnd.blocks.find((entry) => entry.id === data.blockId);
    return (
      <BuilderBlockPreview
        size={block && sizes.get(block.spriteId)}
        doc={block && docs.get(block.spriteId)}
      />
    );
  };

  return (
    <CommandsProvider value={commands}>
      <div className="grid h-dvh grid-rows-[auto_1fr_auto_auto] gap-2 overflow-hidden bg-background p-2">
        <Panel render={<header />} className="flex min-w-0 items-center gap-2 px-2 py-1.5">
          {/* A link, not a command button: navigation belongs to the <Link>. */}
          <TooltipButton
            label="Back to sprites"
            shortcut={commandKeys("app.backToLibrary")}
            size="icon-sm"
            variant="ghost"
            className="shrink-0"
            nativeButton={false}
            render={
              <Link to={ROUTES.sprites}>
                <ArrowLeft />
              </Link>
            }
          />

          <SpritesheetMenu />

          <InlineNameField
            label="Spritesheet name"
            name={name}
            className="flex-1 sm:max-w-48"
            onCommit={(next) => doc.setMeta({ name: next })}
          />

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

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <BuilderViewControls tileSize={tileSize} />

            <CommandButton command="app.shortcutHelp">
              <Keyboard />
            </CommandButton>

            <Separator orientation="vertical" className="h-5" />

            {/* aria-label, because the label below is display:none at small widths — which would
                otherwise empty the button's accessible name along with it. */}
            <Button
              size="sm"
              aria-label="Export"
              onClick={() => void exportSheet.run(name, dnd.blocks, docs)}
              disabled={exportSheet.isRunning || dnd.blocks.length === 0}
            >
              <Download />
              <span className="hidden sm:inline">Export</span>
            </Button>

            <SaveStatusBadge status={saveStatus} />
          </div>
        </Panel>

        {/* No animated drop: a block lands in the slot the drag already opened for it. */}
        <DragBoard<DragData>
          animateDrop={false}
          onDragStart={dnd.handleDragStart}
          onDragOver={dnd.handleDragOver}
          onDragMove={dnd.handleDragMove}
          onDrop={dnd.handleDragEnd}
          renderPreview={renderPreview}
        >
          <BuilderCanvas
            rows={dnd.rows}
            sizes={sizes}
            docs={docs}
            ghostId={dnd.ghostId}
            onRemoveBlock={dnd.removeBlock}
          />
          <BuilderPalette placedSpriteIds={placedSpriteIds} />
        </DragBoard>

        <BuilderStatusBar sheet={sheet} blockCount={dnd.blocks.length} />

        <ShortcutHelpDialog
          commands={commands}
          open={showHelp}
          onOpenChange={setShowHelp}
          description="Every key and gesture the spritesheet editor understands."
          hints={[BUILDER_VIEW_HINTS]}
        />
      </div>
    </CommandsProvider>
  );
}

function BuilderSkeleton() {
  return (
    <div className="grid h-dvh place-items-center bg-background p-2">
      <Skeleton className="h-40 w-64" shape="xl" />
    </div>
  );
}
