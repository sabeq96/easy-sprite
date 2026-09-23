import { ArrowLeftRight } from "lucide-react";
import { ColorPickerPopover } from "@/components/common/ColorPickerPopover";
import { TooltipButton } from "@/components/common/TooltipButton";
import type { PaletteDragData, PaletteDragSource } from "@/components/editor/PalettePanel";
import { shortcutHint } from "@/constants/shortcuts";
import { useDragSource } from "@/hooks/useDnd";
import { rgbaToHex, type RGBA } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";

/** The classic overlapping primary/secondary swatches, each opening the picker. */
export function ActiveColors() {
  const primaryColor = useEditorStore((state) => state.primaryColor);
  const secondaryColor = useEditorStore((state) => state.secondaryColor);
  const setPrimaryColor = useEditorStore((state) => state.setPrimaryColor);
  const setSecondaryColor = useEditorStore((state) => state.setSecondaryColor);
  const swapColors = useEditorStore((state) => state.swapColors);

  return (
    <div className="flex items-center gap-2">
      <div className="relative size-10">
        <DraggableActiveSwatch
          id="active-secondary"
          source="active-secondary"
          color={secondaryColor}
          onChange={setSecondaryColor}
          className="absolute right-0 bottom-0 size-6"
        />
        <DraggableActiveSwatch
          id="active-primary"
          source="active-primary"
          color={primaryColor}
          onChange={setPrimaryColor}
          className="absolute top-0 left-0 size-7"
        />
      </div>

      <TooltipButton
        label="Swap colors"
        shortcut={shortcutHint("color.swap")}
        size="icon-xs"
        onClick={swapColors}
      >
        <ArrowLeftRight />
      </TooltipButton>
    </div>
  );
}

function DraggableActiveSwatch({
  id,
  source,
  color,
  onChange,
  className,
}: {
  id: string;
  source: PaletteDragSource;
  color: RGBA;
  onChange: (color: RGBA) => void;
  className: string;
}) {
  const hex = rgbaToHex(color, true);
  const { dragProps, dragClass } = useDragSource(id, {
    data: { hex, source } satisfies PaletteDragData,
  });

  return (
    <ColorPickerPopover value={color} onChange={onChange}>
      <button
        type="button"
        aria-label={`${source === "active-primary" ? "Primary" : "Secondary"} color ${hex}`}
        {...dragProps}
        className={cn(
          "rounded-full border border-black/30 bg-checker-a focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className,
          dragClass,
        )}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: rgbaToHex(color), opacity: color.a / 255 }}
        />
      </button>
    </ColorPickerPopover>
  );
}
