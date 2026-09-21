import { useEffect, useMemo, useRef, useState } from "react";
import { pointerWithin } from "@dnd-kit/core";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Download } from "lucide-react";
import { Link, useParams } from "react-router";
import { BuilderBlockPreview } from "@/components/builder/BuilderBlock";
import { BuilderCanvas } from "@/components/builder/BuilderCanvas";
import { BuilderExportDialog } from "@/components/builder/BuilderExportDialog";
import { BuilderPalette, SpriteTilePreview } from "@/components/builder/BuilderPalette";
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
import type { SpriteDocument } from "@/editor/document";
import { useSaveStatus } from "@/hooks/useSaveStatus";
import { openDocument } from "@/services/documentService";

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

/** Opens (and caches) a SpriteDocument per distinct sprite referenced by the current blocks. */
function useDocumentCache(spriteIds: string[]): Map<string, SpriteDocument> {
  const [docs, setDocs] = useState<Map<string, SpriteDocument>>(new Map());

  useEffect(() => {
    const missing = spriteIds.filter((id) => !docs.has(id));
    if (missing.length === 0) return;

    let cancelled = false;
    void Promise.all(
      missing.map((id) => openDocument(id).then((doc) => [id, doc] as const)),
    ).then((entries) => {
      if (cancelled) return;
      setDocs((current) => {
        const next = new Map(current);
        for (const [id, doc] of entries) next.set(id, doc);
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [spriteIds, docs]);

  return docs;
}

function SpritesheetBuilderShell({ spritesheet }: { spritesheet: SpritesheetRecord }) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const save = useSaveStatus();
  const [isExporting, setExporting] = useState(false);

  const spriteIds = useMemo(
    () => [...new Set(spritesheet.blocks.map((block) => block.spriteId))],
    [spritesheet.blocks],
  );
  const docs = useDocumentCache(spriteIds);
  const { handleDragEnd, removeBlock } = useBuilderDnd(spritesheet, docs, canvasRef, save.track);

  const renderPreview = (data: DragData) => {
    if (data.type === "palette") {
      return <SpriteTilePreview name={data.name} thumbnail={data.thumbnail} />;
    }
    const block = spritesheet.blocks.find((entry) => entry.id === data.blockId);
    return <BuilderBlockPreview doc={block && docs.get(block.spriteId)} />;
  };

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr_auto] gap-2 overflow-hidden bg-background p-2">
      <Panel render={<header />} className="flex items-center gap-2 px-2 py-1.5">
        <Button
          aria-label="Back to sprites"
          size="icon-sm"
          variant="ghost"
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
          onCommit={(name) => void save.track(updateSpritesheet(spritesheet.id, { name }))}
        />

        <div className="ml-auto flex items-center gap-2">
          <Separator orientation="vertical" className="h-5" />

          <Button size="sm" onClick={() => setExporting(true)}>
            <Download />
            Export
          </Button>

          <SaveStatusBadge status={save.status} />
        </div>
      </Panel>

      {/* pointerWithin, because a drop is decided by where the cursor is — a palette tile's own
          rect sits down in the dock and says nothing about which part of the sheet it is over.
          No `items`: blocks sit at free x/y positions rather than in a reorderable list. */}
      <DragBoard<DragData>
        collisionDetection={pointerWithin}
        animateDrop={false}
        onDrop={handleDragEnd}
        renderPreview={renderPreview}
      >
        <BuilderCanvas
          canvasRef={canvasRef}
          blocks={spritesheet.blocks}
          docs={docs}
          onRemoveBlock={removeBlock}
        />
        <BuilderPalette placedSpriteIds={new Set(spriteIds)} />
      </DragBoard>

      <BuilderExportDialog
        name={spritesheet.name}
        blocks={spritesheet.blocks}
        docs={docs}
        open={isExporting}
        onOpenChange={setExporting}
      />
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
