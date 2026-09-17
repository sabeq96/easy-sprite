import { ArrowLeftRight } from "lucide-react";
import { ColorPickerPopover } from "@/components/common/ColorPickerPopover";
import { TooltipButton } from "@/components/common/TooltipButton";
import { shortcutHint } from "@/constants/shortcuts";
import { rgbaToHex } from "@/lib/color";
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
        <ColorPickerPopover value={secondaryColor} onChange={setSecondaryColor}>
          <button
            type="button"
            aria-label={`Secondary color ${rgbaToHex(secondaryColor, true)}`}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("text/color-hex", rgbaToHex(secondaryColor, true));
              // Must include whatever dropEffect the target's dragover requests ("move"), or
              // the browser silently rejects the drop even though the target accepted it.
              event.dataTransfer.effectAllowed = "copyMove";
            }}
            className="absolute right-0 bottom-0 size-6 rounded-full border border-black/30 bg-checker-a focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: rgbaToHex(secondaryColor),
                opacity: secondaryColor.a / 255,
              }}
            />
          </button>
        </ColorPickerPopover>

        <ColorPickerPopover value={primaryColor} onChange={setPrimaryColor}>
          <button
            type="button"
            aria-label={`Primary color ${rgbaToHex(primaryColor, true)}`}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("text/color-hex", rgbaToHex(primaryColor, true));
              // Must include whatever dropEffect the target's dragover requests ("move"), or
              // the browser silently rejects the drop even though the target accepted it.
              event.dataTransfer.effectAllowed = "copyMove";
            }}
            className="absolute top-0 left-0 size-7 rounded-full border border-black/30 bg-checker-a focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: rgbaToHex(primaryColor),
                opacity: primaryColor.a / 255,
              }}
            />
          </button>
        </ColorPickerPopover>
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
