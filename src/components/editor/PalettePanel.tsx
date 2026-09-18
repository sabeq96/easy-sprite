import { useState } from "react";
import { Palette as PaletteIcon } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDocumentSession } from "@/app/DocumentProvider";
import { ColorSwatch } from "@/components/common/ColorSwatch";
import { ActiveColors } from "@/components/editor/ActiveColors";
import { PaletteMenu } from "@/components/editor/PaletteMenu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { updatePalette } from "@/db/repositories/palettes";
import { useColorUsage } from "@/hooks/useColorUsage";
import { usePalettes } from "@/hooks/usePalettes";
import { hexToRgba, rgbaToHex, rgbaEquals, type RGBA } from "@/lib/color";
import { useAppDndSensors } from "@/lib/dnd";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";

export type PaletteDragSource = "palette" | "recent" | "used" | "active-primary" | "active-secondary";
export interface PaletteDragData {
  hex: string;
  source: PaletteDragSource;
}

const PALETTE_DROP_ZONE_ID = "palette-drop-zone";
const paletteSwatchId = (hex: string) => `palette:${hex}`;
const recentSwatchId = (hex: string) => `recent:${hex}`;
const usedSwatchId = (hex: string) => `used:${hex}`;
const hexFromPaletteSwatchId = (id: string) =>
  id.startsWith("palette:") ? id.slice("palette:".length) : null;

export function PalettePanel() {
  const { doc } = useDocumentSession();
  const { palettes, active } = usePalettes();
  const usage = useColorUsage(doc);

  const setActivePalette = useEditorStore((state) => state.setActivePalette);
  const primaryColor = useEditorStore((state) => state.primaryColor);
  const setPrimaryColor = useEditorStore((state) => state.setPrimaryColor);
  const setSecondaryColor = useEditorStore((state) => state.setSecondaryColor);
  const recentColors = useEditorStore((state) => state.recentColors);
  const sensors = useAppDndSensors();
  const [dragData, setDragData] = useState<PaletteDragData | null>(null);
  // Purely a read of dnd-kit's own `over` result, for the highlight ring — never feeds back into
  // layout or collision detection, so this can't create the kind of update loop a synthetic
  // "make room" placeholder did.
  const [isOverPalette, setIsOverPalette] = useState(false);

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id;
    setIsOverPalette(
      overId === PALETTE_DROP_ZONE_ID || (typeof overId === "string" && overId.startsWith("palette:")),
    );
  };

  const handleDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    setDragData(null);
    setIsOverPalette(false);
    const data = dragged.data.current as PaletteDragData | undefined;
    if (!data) return;

    if (!over) {
      // Dropped nowhere: only removes when dragged OUT of the (editable) palette itself.
      if (data.source === "palette" && active && !active.builtIn) {
        void updatePalette(active.id, { colors: active.colors.filter((entry) => entry !== data.hex) });
      }
      return;
    }

    if (!active || active.builtIn) return; // read-only drop target

    const overHex = hexFromPaletteSwatchId(String(over.id));
    const targetIndex = overHex ? Math.max(active.colors.indexOf(overHex), 0) : active.colors.length;
    const hex = normalizePaletteHex(data.hex);
    void updatePalette(active.id, { colors: upsertColorAt(active.colors, hex, targetIndex) });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(event: DragStartEvent) =>
        setDragData((event.active.data.current as PaletteDragData) ?? null)
      }
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDragData(null);
        setIsOverPalette(false);
      }}
    >
      <section aria-label="Colors" className="flex shrink-0 flex-col gap-2 p-2">
        <div className="flex items-center gap-2">
          <ActiveColors />
          <Separator orientation="vertical" className="h-8" />
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <Select
              value={active?.id ?? ""}
              onValueChange={(value) => setActivePalette(typeof value === "string" ? value : null)}
            >
              <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label="Active palette">
                {/* Base UI renders the raw value by default; map it back to the palette name. */}
                <SelectValue placeholder="Palette">
                  {(value: string) =>
                    palettes.find((palette) => palette.id === value)?.name ?? "Palette"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {palettes.map((palette) => (
                  <SelectItem key={palette.id} value={palette.id}>
                    {palette.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <PaletteMenu palette={active} />
          </div>
        </div>

        <SwatchGrid
          label="Palette colors"
          colors={active?.colors ?? []}
          activeColor={primaryColor}
          showIndexHints
          source="palette"
          sortable={Boolean(active && !active.builtIn)}
          isOverPalette={isOverPalette}
          onPick={setPrimaryColor}
          onPickSecondary={setSecondaryColor}
          onRemove={
            active && !active.builtIn
              ? (hex) =>
                  void updatePalette(active.id, {
                    colors: active.colors.filter((entry) => entry !== hex),
                  })
              : undefined
          }
        />

        {recentColors.length > 0 && (
          <SwatchGrid
            label="Recent"
            colors={recentColors}
            activeColor={primaryColor}
            source="recent"
            onPick={setPrimaryColor}
            onPickSecondary={setSecondaryColor}
          />
        )}

        {usage.length > 0 && (
          <SwatchGrid
            label="Used in sprite"
            colors={usage.map((entry) => entry.hex)}
            activeColor={primaryColor}
            source="used"
            onPick={setPrimaryColor}
            onPickSecondary={setSecondaryColor}
          />
        )}
      </section>

      <DragOverlay>{dragData ? <PaletteDragPreview hex={dragData.hex} /> : null}</DragOverlay>
    </DndContext>
  );
}

/** Re-encodes any incoming hex (with or without alpha) to this app's storage convention. */
function normalizePaletteHex(hex: string): string {
  const rgba = hexToRgba(hex);
  return rgbaToHex(rgba, rgba.a !== 255);
}

/** Drops `hex` at `targetIndex`, removing any earlier occurrence first — dedupe via move. */
function upsertColorAt(colors: string[], hex: string, targetIndex: number): string[] {
  const next = colors.filter((entry) => entry !== hex);
  const index = Math.min(Math.max(targetIndex, 0), next.length);
  next.splice(index, 0, hex);
  return next;
}

function PaletteDragPreview({ hex }: { hex: string }) {
  const color = hexToRgba(hex);
  return (
    <div className="pointer-events-none relative size-7 scale-110 rounded-full border border-black/30 bg-checker-a shadow-lg ring-2 ring-ring">
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: rgbaToHex(color), opacity: color.a / 255 }}
      />
    </div>
  );
}

interface SwatchGridProps {
  label: string;
  colors: string[];
  activeColor: RGBA;
  showIndexHints?: boolean;
  source: "palette" | "recent" | "used";
  /** true only for the editable "Palette colors" grid — enables SortableContext + drop zone. */
  sortable?: boolean;
  /** Highlight the drop zone — true whenever a drag is over the palette, on any swatch or not. */
  isOverPalette?: boolean;
  onPick: (color: RGBA) => void;
  onPickSecondary: (color: RGBA) => void;
  onRemove?: (hex: string) => void;
}

function SwatchGrid({
  label,
  colors,
  activeColor,
  showIndexHints,
  source,
  sortable,
  isOverPalette,
  onPick,
  onPickSecondary,
  onRemove,
}: SwatchGridProps) {
  const idFor = source === "palette" ? paletteSwatchId : source === "recent" ? recentSwatchId : usedSwatchId;
  const ids = colors.map(idFor);
  // Every SwatchGrid instance calls useDroppable (rules of hooks), but only "palette" ever has
  // sortable=true — give the other two their own id so they can never shadow the real drop zone.
  const dropZoneId = source === "palette" ? PALETTE_DROP_ZONE_ID : `${source}-drop-zone`;
  const dropZone = useDroppable({ id: dropZoneId, disabled: !sortable });

  const swatches = colors.map((hex, index) => {
    const color = hexToRgba(hex);
    const commonProps = {
      id: ids[index],
      hex,
      color,
      index: showIndexHints ? index : undefined,
      isActive: rgbaEquals(color, activeColor),
      onPick,
      onPickSecondary,
      onRemove: source === "palette" ? onRemove : undefined,
    };
    return sortable ? (
      <SortableSwatch key={ids[index]} {...commonProps} />
    ) : (
      <DraggableSwatch key={ids[index]} {...commonProps} source={source} />
    );
  });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase">
        <PaletteIcon className="size-3" />
        {label}
      </div>

      {colors.length === 0 ? (
        <p
          ref={sortable ? dropZone.setNodeRef : undefined}
          className="text-xs text-muted-foreground"
        >
          {sortable ? "Drag colors here to add them." : "No colors yet."}
        </p>
      ) : (
        <div
          ref={sortable ? dropZone.setNodeRef : undefined}
          className={cn(
            "flex flex-wrap rounded-md p-0.5 transition-colors",
            sortable && isOverPalette && "bg-primary/10 ring-1 ring-primary/40",
          )}
        >
          {sortable ? (
            <SortableContext items={ids} strategy={rectSortingStrategy}>
              {swatches}
            </SortableContext>
          ) : (
            swatches
          )}
        </div>
      )}
    </div>
  );
}

interface BaseSwatchProps {
  id: string;
  hex: string;
  color: RGBA;
  index?: number;
  isActive: boolean;
  onPick: (color: RGBA) => void;
  onPickSecondary: (color: RGBA) => void;
  onRemove?: (hex: string) => void;
}

/** Plain drag source — Recent, Used-in-sprite, and Palette-colors when the palette is built-in. */
function DraggableSwatch({
  id,
  hex,
  color,
  index,
  isActive,
  onPick,
  onPickSecondary,
  onRemove,
  source,
}: BaseSwatchProps & { source: PaletteDragSource }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { hex, source } satisfies PaletteDragData,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        // Padding (not the container's gap) makes the interactive hitbox touch its neighbor,
        // so pointerWithin always resolves to a specific swatch — never the vague gap between
        // two of them — which is what makes "drop between two colors" land precisely.
        "touch-none p-0.5",
        isDragging && "opacity-40",
      )}
      onDoubleClick={() => onRemove?.(hex)}
      title={onRemove ? `${hex} — drag out or double-click to remove` : hex}
    >
      <ColorSwatch
        color={color}
        index={index}
        isActive={isActive}
        onPick={onPick}
        onPickSecondary={onPickSecondary}
      />
    </div>
  );
}

/** Sortable drag source — only for the editable Palette-colors grid. */
function SortableSwatch({
  id,
  hex,
  color,
  index,
  isActive,
  onPick,
  onPickSecondary,
  onRemove,
}: BaseSwatchProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { hex, source: "palette" } satisfies PaletteDragData,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        // Padding (not the container's gap) makes the interactive hitbox touch its neighbor,
        // so pointerWithin always resolves to a specific swatch — never the vague gap between
        // two of them — which is what makes "drop between two colors" land precisely.
        "touch-none p-0.5",
        isDragging && "opacity-40",
      )}
      onDoubleClick={() => onRemove?.(hex)}
      title={`${hex} — drag out or double-click to remove`}
    >
      <ColorSwatch
        color={color}
        index={index}
        isActive={isActive}
        onPick={onPick}
        onPickSecondary={onPickSecondary}
      />
    </div>
  );
}
