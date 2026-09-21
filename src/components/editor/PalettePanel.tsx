import { useState } from "react";
import { Palette as PaletteIcon } from "lucide-react";
import { pointerWithin, type DragEndEvent } from "@dnd-kit/core";
import { rectSortingStrategy } from "@dnd-kit/sortable";
import { useDocumentSession } from "@/app/DocumentProvider";
import { ColorSwatch } from "@/components/common/ColorSwatch";
import { DragBoard } from "@/components/common/DragBoard";
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
import { useDragSource, useDropZone, useSortableItem } from "@/hooks/useDnd";
import { hexToRgba, rgbaToHex, rgbaEquals, type RGBA } from "@/lib/color";
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
  const [reordered, setReordered] = useState<{ paletteId: string; colors: string[] } | null>(null);

  // A reorder is written to Dexie and only comes back through useLiveQuery a few async ticks
  // later — long enough to watch a dropped swatch return to its old slot and animate over again.
  // Rendering the new order straight away makes the drop land where it was released.
  //
  // The override stands only while the stored palette is the same colors in some other order, so
  // the write arriving (or any real edit, from here or another surface) immediately takes over.
  const stored = active?.colors ?? [];
  const colors =
    reordered && reordered.paletteId === active?.id && isReorderOf(reordered.colors, stored)
      ? reordered.colors
      : stored;

  const paletteIds = colors.map(paletteSwatchId);
  const editable = Boolean(active && !active.builtIn);

  const writeColors = (next: string[]) => {
    if (!active || !editable) return;
    if (isReorderOf(next, colors)) setReordered({ paletteId: active.id, colors: next });
    void updatePalette(active.id, { colors: next });
  };

  const handleDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    const data = dragged.data.current as PaletteDragData | undefined;
    if (!data) return;

    if (!over) {
      // Dropped nowhere: only removes when dragged OUT of the (editable) palette itself.
      if (data.source === "palette") writeColors(colors.filter((entry) => entry !== data.hex));
      return;
    }

    const overHex = hexFromPaletteSwatchId(String(over.id));
    const targetIndex = overHex ? Math.max(colors.indexOf(overHex), 0) : colors.length;
    writeColors(upsertColorAt(colors, normalizePaletteHex(data.hex), targetIndex));
  };

  return (
    <DragBoard<PaletteDragData>
      items={paletteIds}
      strategy={rectSortingStrategy}
      collisionDetection={pointerWithin}
      onDrop={handleDragEnd}
      renderPreview={(data) => <PaletteDragPreview hex={data.hex} />}
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
          colors={colors}
          activeColor={primaryColor}
          showIndexHints
          source="palette"
          sortable={editable}
          onPick={setPrimaryColor}
          onPickSecondary={setSecondaryColor}
          onRemove={
            editable ? (hex) => writeColors(colors.filter((entry) => entry !== hex)) : undefined
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
    </DragBoard>
  );
}

/** Re-encodes any incoming hex (with or without alpha) to this app's storage convention. */
function normalizePaletteHex(hex: string): string {
  const rgba = hexToRgba(hex);
  return rgbaToHex(rgba, rgba.a !== 255);
}

/** The same colors in some other order — the one case an optimistic reorder may stand in for. */
function isReorderOf(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

/** Drops `hex` at `targetIndex`, removing any earlier occurrence first — dedupe via move. */
function upsertColorAt(colors: string[], hex: string, targetIndex: number): string[] {
  const next = colors.filter((entry) => entry !== hex);
  const index = Math.min(Math.max(targetIndex, 0), next.length);
  next.splice(index, 0, hex);
  return next;
}

/** The swatch's own visual, for the board's drag overlay — DragBoard supplies the lift and ring. */
function PaletteDragPreview({ hex }: { hex: string }) {
  const color = hexToRgba(hex);
  return (
    <div className="relative size-7 rounded-full border border-black/30 bg-checker-a">
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
  /** true only for the editable "Palette colors" grid — enables sorting + the drop zone. */
  sortable?: boolean;
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
  onPick,
  onPickSecondary,
  onRemove,
}: SwatchGridProps) {
  const idFor = source === "palette" ? paletteSwatchId : source === "recent" ? recentSwatchId : usedSwatchId;
  const ids = colors.map(idFor);
  // Every SwatchGrid instance calls useDropZone (rules of hooks), but only "palette" ever has
  // sortable=true — give the other two their own id so they can never shadow the real drop zone.
  const dropZoneId = source === "palette" ? PALETTE_DROP_ZONE_ID : `${source}-drop-zone`;
  // `owns`: a swatch is itself a drop target and wins the collision over the grid behind it, so the
  // grid has to claim its own swatches to stay highlighted while the pointer is on one of them.
  const dropZone = useDropZone({
    id: dropZoneId,
    disabled: !sortable,
    owns: (overId) => overId.startsWith("palette:"),
  });

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
          ref={sortable ? dropZone.ref : undefined}
          className={cn("rounded-md p-0.5 text-xs text-muted-foreground", dropZone.dropClass)}
        >
          {sortable ? "Drag colors here to add them." : "No colors yet."}
        </p>
      ) : (
        <div
          ref={sortable ? dropZone.ref : undefined}
          className={cn("flex flex-wrap rounded-md p-0.5", dropZone.dropClass)}
        >
          {swatches}
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
  const { dragProps, dragClass } = useDragSource(id, { hex, source } satisfies PaletteDragData);

  return (
    <div
      {...dragProps}
      className={cn(
        // Padding (not the container's gap) makes the interactive hitbox touch its neighbor,
        // so pointerWithin always resolves to a specific swatch — never the vague gap between
        // two of them — which is what makes "drop between two colors" land precisely.
        "rounded-full p-0.5",
        dragClass,
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
  const { dragProps, dragClass } = useSortableItem(id, {
    hex,
    source: "palette",
  } satisfies PaletteDragData);

  return (
    <div
      {...dragProps}
      className={cn(
        // Padding (not the container's gap) makes the interactive hitbox touch its neighbor,
        // so pointerWithin always resolves to a specific swatch — never the vague gap between
        // two of them — which is what makes "drop between two colors" land precisely.
        "rounded-full p-0.5",
        dragClass,
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
