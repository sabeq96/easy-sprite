import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay, pointerWithin, type DragStartEvent } from "@dnd-kit/core";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Download } from "lucide-react";
import { Link, useParams } from "react-router";
import { BuilderCanvas } from "@/components/builder/BuilderCanvas";
import { BuilderExportDialog } from "@/components/builder/BuilderExportDialog";
import { BuilderPalette } from "@/components/builder/BuilderPalette";
import { useBuilderDnd, type DragData } from "@/components/builder/useBuilderDnd";
import { NotFoundPage } from "@/components/common/NotFoundPage";
import { Panel } from "@/components/common/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { db } from "@/db/db";
import { getSpritesheet, updateSpritesheet } from "@/db/repositories/spritesheets";
import type { SpritesheetRecord } from "@/db/schema";
import type { SpriteDocument } from "@/editor/document";
import { useAppDndSensors } from "@/lib/dnd";
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
  const sensors = useAppDndSensors();
  const [isExporting, setExporting] = useState(false);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [draggedName, setDraggedName] = useState<string | null>(null);

  const spriteIds = useMemo(
    () => [...new Set(spritesheet.blocks.map((block) => block.spriteId))],
    [spritesheet.blocks],
  );
  const docs = useDocumentCache(spriteIds);
  const { handleDragEnd, removeBlock } = useBuilderDnd(spritesheet, docs, canvasRef);

  const commitName = () => {
    const next = nameDraft?.trim();
    if (next && next !== spritesheet.name) void updateSpritesheet(spritesheet.id, { name: next });
    setNameDraft(null);
  };

  // Only palette drags need an overlay; a block already on the sheet moves under its own transform.
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    setDraggedName(data?.type === "palette" ? data.name : null);
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

        <Input
          aria-label="Spritesheet name"
          className="h-7 w-48 border-transparent bg-transparent hover:border-border focus:border-border"
          value={nameDraft ?? spritesheet.name}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setNameDraft(null);
              event.currentTarget.blur();
            }
          }}
        />

        <Separator orientation="vertical" className="h-5" />

        <div className="ml-auto">
          <Button size="sm" onClick={() => setExporting(true)}>
            <Download />
            Export
          </Button>
        </div>
      </Panel>

      {/* pointerWithin, because a drop is decided by where the cursor is — a palette tile's own
          rect sits down in the dock and says nothing about which part of the sheet it is over. */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragCancel={() => setDraggedName(null)}
        onDragEnd={(event) => {
          setDraggedName(null);
          handleDragEnd(event);
        }}
      >
        <BuilderCanvas
          canvasRef={canvasRef}
          blocks={spritesheet.blocks}
          docs={docs}
          onRemoveBlock={removeBlock}
        />
        <BuilderPalette />

        {/* A palette tile lives inside a horizontally scrolling dock, so dragging it would be
            clipped at the dock's edge. The overlay is portalled out, so it can cross the page. */}
        <DragOverlay dropAnimation={null}>
          {draggedName && (
            <div className="rounded-md border border-dashed border-ring bg-card/90 px-2 py-1 text-xs shadow-lg">
              {draggedName}
            </div>
          )}
        </DragOverlay>
      </DndContext>

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
      <Skeleton className="h-40 w-64 rounded-xl" />
    </div>
  );
}
