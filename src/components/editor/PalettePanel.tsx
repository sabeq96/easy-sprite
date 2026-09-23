import { useRef, useState } from "react";
import { Palette as PaletteIcon } from "lucide-react";
import { arrayMove } from "@dnd-kit/helpers";
import { isSortable } from "@dnd-kit/react/sortable";
import { useDocumentSession } from "@/app/DocumentProvider";
import { ColorSwatch } from "@/components/common/ColorSwatch";
import { DragBoard, type DragEndEvent, type DragOverEvent } from "@/components/common/DragBoard";
import { HintList } from "@/components/common/HintList";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { updatePalette } from "@/db/repositories/palettes";
import { COLOR_HOTKEY_HINTS } from "@/hooks/useColorHotkeys";
import { useColorUsage } from "@/hooks/useColorUsage";
import { useOptimisticOrder } from "@/hooks/useOptimisticOrder";
import { usePalettes } from "@/hooks/usePalettes";
import { useDragSource, useDropZone, useSortableItem } from "@/hooks/useDnd";
import { hexToRgba, rgbaToHex, rgbaEquals, type RGBA } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";

export type PaletteDragSource = "palette" | "used" | "active-primary" | "active-secondary";
export interface PaletteDragData {
  hex: string;
  source: PaletteDragSource;
}

/** Where a color copied in from outside the palette would land, shown live while it is dragged. */
interface IncomingColor {
  hex: string;
  index: number;
}

const PALETTE_DROP_ZONE_ID = "palette-drop-zone";
/** The stand-in swatch for a color being copied in. Never a real palette entry. */
const INCOMING_SWATCH_ID = "palette-incoming";
// Stable reference for "no active palette", so the live read's identity check doesn't see a new []
// every render.
const NO_COLORS: string[] = [];
const paletteSwatchId = (hex: string) => `palette:${hex}`;
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

  // usePalettes only hands back a new `active.colors` reference when the live query actually
  // re-ran, which is exactly the "has the read caught up" signal useOptimisticOrder keys on — so a
  // drop renders its new order (or its new color) at once instead of snapping back for a few ticks.
  const stored = useOptimisticOrder(active?.colors ?? NO_COLORS);
  const colors = stored.items;
  const editable = Boolean(active);

  const [incoming, setIncoming] = useState<IncomingColor | null>(null);
  // The drop handler reads this rather than `incoming`: the last dragover's state update is a
  // transition, and may not have rendered yet when a quick release lands.
  const incomingRef = useRef<IncomingColor | null>(null);
  const showIncoming = (next: IncomingColor | null) => {
    const current = incomingRef.current;
    if (current?.hex === next?.hex && current?.index === next?.index) return;
    incomingRef.current = next;
    setIncoming(next);
  };

  const writeColors = (next: string[]) => {
    if (!active) return;
    stored.propose(next);
    void updatePalette(active.id, { colors: next });
  };

  // Palette swatches are sorted by the library itself; only a color copied in from outside the
  // palette (a "used" swatch, the active colors) needs a stand-in injected at its landing slot.
  const handleDragOver = ({ operation }: DragOverEvent) => {
    const data = operation.source?.data as PaletteDragData | undefined;
    if (!data || data.source === "palette" || !editable) return;

    const overId = operation.target ? String(operation.target.id) : null;
    if (overId === INCOMING_SWATCH_ID) return; // already sitting under the pointer

    const hex = normalizePaletteHex(data.hex);
    const others = colors.filter((entry) => entry !== hex);
    const overHex = overId ? hexFromPaletteSwatchId(overId) : null;

    if (overHex !== null && others.includes(overHex)) {
      showIncoming({ hex, index: others.indexOf(overHex) });
    } else if (overId === PALETTE_DROP_ZONE_ID) {
      showIncoming({ hex, index: others.length });
    } else {
      showIncoming(null);
    }
  };

  const handleDragEnd = ({ operation, canceled }: DragEndEvent) => {
    const data = operation.source?.data as PaletteDragData | undefined;
    const landing = incomingRef.current;
    showIncoming(null);
    if (!data || canceled || !editable) return;

    if (data.source !== "palette") {
      if (landing) writeColors(upsertColorAt(colors, landing.hex, landing.index));
      return;
    }

    // Dropped nowhere: a palette swatch dragged out of the palette is removed from it.
    if (!operation.target) {
      writeColors(colors.filter((entry) => entry !== data.hex));
      return;
    }

    const { source } = operation;
    if (isSortable(source) && source.initialIndex !== source.index) {
      writeColors(arrayMove([...colors], source.initialIndex, source.index));
    }
  };

  const entries = withIncoming(colors, incoming);

  return (
    <DragBoard<PaletteDragData>
      onDragOver={handleDragOver}
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

        {/* One card for the whole grid (not a badge or tooltip per swatch) teaching the 1–9 keys. */}
        <Tooltip>
          <TooltipTrigger render={<div />}>
            <SwatchGrid
              label="Palette colors"
              entries={entries}
              activeColor={primaryColor}
              source="palette"
              sortable={editable}
              onPick={setPrimaryColor}
              onPickSecondary={setSecondaryColor}
              onRemove={
                editable ? (hex) => writeColors(colors.filter((entry) => entry !== hex)) : undefined
              }
            />
          </TooltipTrigger>
          <TooltipContent side="left" align="start" className="block">
            <HintList hints={COLOR_HOTKEY_HINTS.hints} />
          </TooltipContent>
        </Tooltip>

        {usage.length > 0 && (
          <SwatchGrid
            label="Used in sprite"
            entries={usage.map((entry) => ({ hex: entry.hex, isIncoming: false }))}
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

interface SwatchEntry {
  hex: string;
  /** The stand-in for a color being copied in — rendered, but not yet in the palette. */
  isIncoming: boolean;
}

/** The palette as it should look right now: with the copied-in color's stand-in at its landing
 *  slot, and without any earlier occurrence of that color (a drop moves it, never duplicates it). */
function withIncoming(colors: string[], incoming: IncomingColor | null): SwatchEntry[] {
  const entries = colors
    .filter((hex) => hex !== incoming?.hex)
    .map((hex) => ({ hex, isIncoming: false }));
  if (incoming) entries.splice(incoming.index, 0, { hex: incoming.hex, isIncoming: true });
  return entries;
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
  entries: SwatchEntry[];
  activeColor: RGBA;
  source: "palette" | "used";
  /** true only for the editable "Palette colors" grid — enables sorting + the drop zone. */
  sortable?: boolean;
  onPick: (color: RGBA) => void;
  onPickSecondary: (color: RGBA) => void;
  onRemove?: (hex: string) => void;
}

function SwatchGrid({
  label,
  entries,
  activeColor,
  source,
  sortable,
  onPick,
  onPickSecondary,
  onRemove,
}: SwatchGridProps) {
  const idFor = source === "palette" ? paletteSwatchId : usedSwatchId;
  // Every SwatchGrid instance calls useDropZone (rules of hooks), but only "palette" is sortable —
  // give the other its own id so it can never shadow the real drop zone.
  const dropZoneId = source === "palette" ? PALETTE_DROP_ZONE_ID : `${source}-drop-zone`;
  // `owns`: a swatch is itself a drop target and wins the collision over the grid behind it, so the
  // grid has to claim its own swatches to stay highlighted while the pointer is on one of them.
  // Low priority for the same reason: a swatch under the pointer must win over the grid.
  const dropZone = useDropZone({
    id: dropZoneId,
    disabled: !sortable,
    priority: "low",
    owns: (overId) => overId.startsWith("palette:") || overId === INCOMING_SWATCH_ID,
  });

  const swatches = entries.map(({ hex, isIncoming }, index) => {
    const color = hexToRgba(hex);
    const id = isIncoming ? INCOMING_SWATCH_ID : idFor(hex);
    const commonProps = {
      id,
      hex,
      color,
      isActive: rgbaEquals(color, activeColor),
      onPick,
      onPickSecondary,
      onRemove: source === "palette" ? onRemove : undefined,
    };
    return sortable ? (
      <SortableSwatch key={id} {...commonProps} position={index} isIncoming={isIncoming} />
    ) : (
      <DraggableSwatch key={id} {...commonProps} source={source} />
    );
  });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase">
        <PaletteIcon className="size-3" />
        {label}
      </div>

      {entries.length === 0 ? (
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
  isActive: boolean;
  onPick: (color: RGBA) => void;
  onPickSecondary: (color: RGBA) => void;
  onRemove?: (hex: string) => void;
}

/** Plain drag source — the read-only "Used in sprite" grid. Every palette grid is sortable now. */
function DraggableSwatch({
  id,
  hex,
  color,
  isActive,
  onPick,
  onPickSecondary,
  onRemove,
  source,
}: BaseSwatchProps & { source: PaletteDragSource }) {
  const { dragProps, dragClass } = useDragSource(id, {
    data: { hex, source } satisfies PaletteDragData,
  });

  return (
    <div
      {...dragProps}
      className={cn(
        // Padding (not the container's gap) makes the interactive hitbox touch its neighbor, so the
        // pointer always resolves to a specific swatch — never the vague gap between two of them —
        // which is what makes "drop between two colors" land precisely.
        "rounded-full p-0.5",
        dragClass,
      )}
      onDoubleClick={() => onRemove?.(hex)}
    >
      <ColorSwatch
        color={color}
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
  position,
  isIncoming,
  isActive,
  onPick,
  onPickSecondary,
  onRemove,
}: BaseSwatchProps & { position: number; isIncoming: boolean }) {
  const { dragProps, dragClass } = useSortableItem(id, {
    index: position,
    group: "palette",
    data: { hex, source: "palette" } satisfies PaletteDragData,
  });

  return (
    <div
      {...dragProps}
      className={cn(
        // Padding (not the container's gap) makes the interactive hitbox touch its neighbor, so the
        // pointer always resolves to a specific swatch — never the vague gap between two of them —
        // which is what makes "drop between two colors" land precisely.
        "rounded-full p-0.5",
        // The stand-in for a color being copied in: already in its slot, visibly not yet committed.
        isIncoming && "opacity-50",
        dragClass,
      )}
      onDoubleClick={() => onRemove?.(hex)}
    >
      <ColorSwatch
        color={color}
        isActive={isActive}
        onPick={onPick}
        onPickSecondary={onPickSecondary}
      />
    </div>
  );
}
