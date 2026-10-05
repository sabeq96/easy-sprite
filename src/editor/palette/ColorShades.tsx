import { Button } from "@/components/ui/button";
import { useDragSource } from "@/hooks/useDnd";
import { rgbaToHex, shadesOf, type RGBA } from "@/lib/color";
import { cn } from "@/lib/utils";
import type { PaletteDragData } from "./PalettePanel";
import { usePaletteActions } from "./usePaletteActions";
import { usePalettes } from "./usePalettes";

/** The Color editor's shades of `color`: click one to pick it, drag one into the palette. */
export function ColorShades({
  color,
  onPick,
}: {
  color: RGBA;
  onPick: (shade: RGBA) => void;
}) {
  const { active } = usePalettes();
  const paletteActions = usePaletteActions();
  const shades = shadesOf(color);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {shades.map((shade, index) => (
          <ShadeSwatch
            key={index}
            id={`shade-${index}`}
            shade={shade}
            isCurrent={shade === color}
            onPick={onPick}
          />
        ))}
      </div>
      <Button
        variant="outline"
        size="xs"
        disabled={!active}
        onClick={() =>
          active &&
          void paletteActions.addColors(
            active,
            shades.map((shade) => rgbaToHex(shade, shade.a !== 255)),
          )
        }
      >
        Add shades to palette
      </Button>
    </div>
  );
}

function ShadeSwatch({
  id,
  shade,
  isCurrent,
  onPick,
}: {
  id: string;
  shade: RGBA;
  isCurrent: boolean;
  onPick: (shade: RGBA) => void;
}) {
  const hex = rgbaToHex(shade, true);
  const { dragProps, dragClass } = useDragSource(id, {
    data: { hex, source: "shade" } satisfies PaletteDragData,
  });

  return (
    <button
      type="button"
      aria-label={`Shade ${hex}`}
      aria-pressed={isCurrent}
      {...dragProps}
      className={cn(
        "relative h-6 flex-1 rounded-sm border border-black/20 bg-checker-a focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        isCurrent && "ring-2 ring-ring",
        dragClass,
      )}
      onClick={() => onPick(shade)}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-sm"
        style={{ backgroundColor: rgbaToHex(shade), opacity: shade.a / 255 }}
      />
    </button>
  );
}
