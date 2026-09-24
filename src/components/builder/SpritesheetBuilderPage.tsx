import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Download } from "lucide-react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { BuilderBlockPreview } from "@/components/builder/BuilderBlock";
import { BuilderCanvas } from "@/components/builder/BuilderCanvas";
import { BuilderPalette, SpriteTilePreview } from "@/components/builder/BuilderPalette";
import { BuilderStatusBar } from "@/components/builder/BuilderStatusBar";
import { BuilderViewControls } from "@/components/builder/BuilderViewControls";
import { useBuilderDnd, type DragData } from "@/components/builder/useBuilderDnd";
import { DragBoard } from "@/components/common/DragBoard";
import { InlineNameField } from "@/components/common/InlineNameField";
import { NotFoundPage } from "@/components/common/NotFoundPage";
import { Panel } from "@/components/common/Panel";
import { SaveStatusBadge } from "@/components/common/SaveStatusBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { db } from "@/db/db";
import { getSpritesheet, updateSpritesheet } from "@/db/repositories/spritesheets";
import type { SpritesheetRecord } from "@/db/schema";
import { downloadBuilderSheetPng } from "@/export/spritesheetBuilder";
import { packSheet } from "@/export/spritesheetBuilderLayout";
import { useSaveStatus } from "@/hooks/useSaveStatus";
import { useSpriteSizes } from "@/hooks/useSpriteSizes";

export function SpritesheetBuilderPage() {
  const { spritesheetId } = useParams<{ spritesheetId: string }>();
  if (!spritesheetId) return <NotFoundPage />;
  return <SpritesheetBuilderLoader spritesheetId={spritesheetId} />;
}

function SpritesheetBuilderLoader({ spritesheetId }: { spritesheetId: string }) {
  const [notFound, setNotFound] = useState(false);
  const spritesheet = useLiveQuery(() => db.spritesheets.get(spritesheetId), [spritesheetId]);

  useEffect(() => {
    let cancelled = false;
    getSpritesheet(spritesheetId).catch(() => {
      if (!cancelled) setNotFound(true);
    });
    return () => {
      cancelled = true;
    };
  }, [spritesheetId]);

  if (notFound) return <NotFoundPage />;
  if (!spritesheet) return <BuilderSkeleton />;
  return <SpritesheetBuilderShell spritesheet={spritesheet} />;
}

function SpritesheetBuilderShell({ spritesheet }: { spritesheet: SpritesheetRecord }) {
  const save = useSaveStatus();
  const [isExporting, setExporting] = useState(false);
  const sizes = useSpriteSizes();
  const dnd = useBuilderDnd(spritesheet, sizes, save.track);
  const { docs } = dnd;

  const sheet = packSheet(dnd.blocks, sizes);
  const placedSpriteIds = new Set(dnd.blocks.map((block) => block.spriteId));

  const exportSheet = async () => {
    setExporting(true);
    try {
      const filename = await downloadBuilderSheetPng(spritesheet.name, dnd.blocks, docs);
      toast.success(`Exported ${filename}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

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
          onCommit={(name) => void save.track(updateSpritesheet(spritesheet.id, { name }))}
        />

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <BuilderViewControls sheet={sheet} />

          <Separator orientation="vertical" className="h-5" />

          {/* aria-label, because the label below is display:none at small widths — which would
              otherwise empty the button's accessible name along with it. */}
          <Button
            size="sm"
            aria-label="Export"
            onClick={() => void exportSheet()}
            disabled={isExporting || dnd.blocks.length === 0}
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
