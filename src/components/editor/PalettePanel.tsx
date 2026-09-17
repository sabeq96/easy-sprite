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
import type { PaletteRecord } from "@/db/schema";
import { useColorUsage } from "@/hooks/useColorUsage";
import { usePalettes } from "@/hooks/usePalettes";
import { hexToRgba, rgbaEquals, type RGBA } from "@/lib/color";
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
    <section aria-label="Colors" className="flex shrink-0 flex-col gap-2 border-b p-2">
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
        onReorder={
          active && !active.builtIn
            ? (from, to) => void updatePalette(active.id, { colors: reorder(active, from, to) })
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

function reorder(palette: PaletteRecord, from: number, to: number): string[] {
  const colors = [...palette.colors];
  const [moved] = colors.splice(from, 1);
  colors.splice(to, 0, moved);
  return colors;
}

interface SwatchGridProps {
  label: string;
  colors: string[];
  activeColor: RGBA;
  showIndexHints?: boolean;
  onPick: (color: RGBA) => void;
  onPickSecondary: (color: RGBA) => void;
  onRemove?: (hex: string) => void;
  onReorder?: (from: number, to: number) => void;
}

function SwatchGrid({
  label,
  colors,
  activeColor,
  showIndexHints,
  onPick,
  onPickSecondary,
  onRemove,
  onReorder,
}: SwatchGridProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase">
        <PaletteIcon className="size-3" />
        {label}
      </div>

      {colors.length === 0 ? (
        <p className="text-xs text-muted-foreground">No colors yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {colors.map((hex, index) => {
            const color = hexToRgba(hex);
            return (
              <div
                key={`${hex}-${index}`}
                draggable={Boolean(onReorder)}
                onDragStart={(event) => event.dataTransfer.setData("text/swatch", String(index))}
                onDragOver={(event) => onReorder && event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const from = Number(event.dataTransfer.getData("text/swatch"));
                  if (!Number.isNaN(from)) onReorder?.(from, index);
                }}
                onDoubleClick={() => onRemove?.(hex)}
                title={onRemove ? `${hex} — double-click to remove` : hex}
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
