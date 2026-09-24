import { ArrowLeft, Download } from "lucide-react";
import { Link, useParams } from "react-router";
import { BuilderBlockPreview } from "@/components/builder/BuilderBlock";
import { BuilderCanvas } from "@/components/builder/BuilderCanvas";
import { BuilderPalette, SpriteTilePreview } from "@/components/builder/BuilderPalette";
import { BuilderStatusBar } from "@/components/builder/BuilderStatusBar";
import { BuilderViewControls } from "@/components/builder/BuilderViewControls";
import { DragBoard } from "@/components/common/DragBoard";
import { InlineNameField } from "@/components/common/InlineNameField";
import { NotFoundPage } from "@/components/common/NotFoundPage";
import { Panel } from "@/components/common/Panel";
import { SaveStatusBadge } from "@/components/common/SaveStatusBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import type { SpritesheetRecord } from "@/db/schema";
import { useBuilderDnd, type DragData } from "@/hooks/useBuilderDnd";
import { useSaveStatus } from "@/hooks/useSaveStatus";
import { useSpriteSizes } from "@/hooks/useSpriteSizes";
import { useSpritesheet } from "@/hooks/useSpritesheet";
import { useSpritesheetActions, useSpritesheetExport } from "@/hooks/useSpritesheetActions";
import { packSheet } from "@/lib/sheetLayout";

export function SpritesheetBuilderPage() {
  const { spritesheetId } = useParams<{ spritesheetId: string }>();
  if (!spritesheetId) return <NotFoundPage />;
  return <SpritesheetBuilderLoader spritesheetId={spritesheetId} />;
}

function SpritesheetBuilderLoader({ spritesheetId }: { spritesheetId: string }) {
  const state = useSpritesheet(spritesheetId);
  if (state.status === "missing") return <NotFoundPage />;
  if (state.status === "loading") return <BuilderSkeleton />;
  return <SpritesheetBuilderShell spritesheet={state.spritesheet} />;
}

function SpritesheetBuilderShell({ spritesheet }: { spritesheet: SpritesheetRecord }) {
  const save = useSaveStatus();
  const actions = useSpritesheetActions();
  const exportSheet = useSpritesheetExport();
  const sizes = useSpriteSizes();
  const dnd = useBuilderDnd(spritesheet, sizes, save.track);
  const { docs } = dnd;

  const sheet = packSheet(dnd.blocks, sizes);
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
    <div className="grid h-dvh grid-rows-[auto_1fr_auto_auto] gap-2 overflow-hidden bg-background p-2">
      <Panel render={<header />} className="flex min-w-0 items-center gap-2 px-2 py-1.5">
        <Button
          aria-label="Back to sprites"
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

        <InlineNameField
          label="Spritesheet name"
          name={spritesheet.name}
          className="flex-1 sm:max-w-48"
          onCommit={(name) => void save.track(actions.update(spritesheet.id, { name }))}
        />

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <BuilderViewControls sheet={sheet} />

          <Separator orientation="vertical" className="h-5" />

          {/* aria-label, because the label below is display:none at small widths — which would
              otherwise empty the button's accessible name along with it. */}
          <Button
            size="sm"
            aria-label="Export"
            onClick={() => void exportSheet.run(spritesheet.name, dnd.blocks, docs)}
            disabled={exportSheet.isRunning || dnd.blocks.length === 0}
          >
            <Download />
            <span className="hidden sm:inline">Export</span>
          </Button>

          <SaveStatusBadge status={save.status} />
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
    </div>
  );
}

function BuilderSkeleton() {
  return (
    <div className="grid h-dvh place-items-center bg-background p-2">
      <Skeleton className="h-40 w-64" shape="xl" />
    </div>
  );
}
