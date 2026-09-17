import { Palette as PaletteIcon } from "lucide-react";
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
import { useEditorStore } from "@/stores/useEditorStore";

export function PalettePanel() {
  const { doc } = useDocumentSession();
  const { palettes, active } = usePalettes();
  const usage = useColorUsage(doc);

  const setActivePalette = useEditorStore((state) => state.setActivePalette);
  const primaryColor = useEditorStore((state) => state.primaryColor);
  const setPrimaryColor = useEditorStore((state) => state.setPrimaryColor);
  const setSecondaryColor = useEditorStore((state) => state.setSecondaryColor);
  const recentColors = useEditorStore((state) => state.recentColors);

  return (
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
        onDropColor={
          active && !active.builtIn
            ? (hex, targetIndex) =>
                void updatePalette(active.id, {
                  colors: upsertColorAt(active.colors, normalizePaletteHex(hex), targetIndex),
                })
            : undefined
        }
      />

      {recentColors.length > 0 && (
        <SwatchGrid
          label="Recent"
          colors={recentColors}
          activeColor={primaryColor}
          onPick={setPrimaryColor}
          onPickSecondary={setSecondaryColor}
        />
      )}

      {usage.length > 0 && (
        <SwatchGrid
          label="Used in sprite"
          colors={usage.map((entry) => entry.hex)}
          activeColor={primaryColor}
          onPick={setPrimaryColor}
          onPickSecondary={setSecondaryColor}
        />
      )}
    </section>
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

interface SwatchGridProps {
  label: string;
  colors: string[];
  activeColor: RGBA;
  showIndexHints?: boolean;
  onPick: (color: RGBA) => void;
  onPickSecondary: (color: RGBA) => void;
  onRemove?: (hex: string) => void;
  /** Present only on the editable palette grid — accepts drops from anywhere colors are shown. */
  onDropColor?: (hex: string, targetIndex: number) => void;
}

function SwatchGrid({
  label,
  colors,
  activeColor,
  showIndexHints,
  onPick,
  onPickSecondary,
  onRemove,
  onDropColor,
}: SwatchGridProps) {
  const acceptsDrop = Boolean(onDropColor);

  const dropAt = (index: number) => (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const hex = event.dataTransfer.getData("text/color-hex");
    if (hex) onDropColor?.(hex, index);
  };

  const allowDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  return (
    <div
      className="flex flex-col gap-1"
      onDragOver={acceptsDrop ? allowDrop : undefined}
      onDrop={acceptsDrop ? dropAt(colors.length) : undefined}
    >
      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase">
        <PaletteIcon className="size-3" />
        {label}
      </div>

      {colors.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {acceptsDrop ? "Drag colors here to add them." : "No colors yet."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {colors.map((hex, index) => {
            const color = hexToRgba(hex);
            return (
              <div
                key={`${hex}-${index}`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/color-hex", hex);
                  // Must include "move" (what every drop target's dragover requests), or the
                  // browser silently rejects the drop even though the target accepted it.
                  event.dataTransfer.effectAllowed = "copyMove";
                }}
                onDragEnd={(event) => {
                  // Dropped somewhere that never accepted it (dropEffect stays "none") — treat
                  // that as "dragged out to remove", the same way a real palette editor would.
                  if (onRemove && event.dataTransfer.dropEffect === "none") onRemove(hex);
                }}
                onDragOver={acceptsDrop ? allowDrop : undefined}
                onDrop={acceptsDrop ? dropAt(index) : undefined}
                onDoubleClick={() => onRemove?.(hex)}
                title={onRemove ? `${hex} — drag out or double-click to remove` : hex}
              >
                <ColorSwatch
                  color={color}
                  index={showIndexHints ? index : undefined}
                  isActive={rgbaEquals(color, activeColor)}
                  onPick={onPick}
                  onPickSecondary={onPickSecondary}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
