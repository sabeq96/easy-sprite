import { luminance, rgbaToHex, type RGBA } from "@/lib/color";
import { cn } from "@/lib/utils";

export interface ColorSwatchProps {
  color: RGBA;
  isActive?: boolean;
  /** Renders the 1–9 hotkey hint on the first nine slots. */
  index?: number;
  size?: "sm" | "md";
  onPick: (color: RGBA) => void;
  onPickSecondary?: (color: RGBA) => void;
}

/**
 * No shadcn primitive covers a colour chip, so this is one of the few bespoke surfaces:
 * a real <button> with the checkerboard showing through translucent colours.
 */
export function ColorSwatch({
  color,
  isActive,
  index,
  size = "md",
  onPick,
  onPickSecondary,
}: ColorSwatchProps) {
  const hex = rgbaToHex(color, true);

  return (
    <button
      type="button"
      title={hex}
      aria-label={`Color ${hex}`}
      aria-pressed={isActive}
      className={cn(
        "relative shrink-0 rounded-full border border-black/20 bg-checker-a transition-transform",
        "hover:z-10 hover:scale-110 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        size === "sm" ? "size-5" : "size-7",
        isActive && "ring-2 ring-ring",
      )}
      onClick={() => onPick(color)}
      onContextMenu={(event) => {
        event.preventDefault();
        onPickSecondary?.(color);
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: rgbaToHex(color), opacity: color.a / 255 }}
      />
      {index !== undefined && index < 9 && (
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] leading-none",
            luminance(color) > 0.5 ? "text-black/60" : "text-white/70",
          )}
        >
          {index + 1}
        </span>
      )}
    </button>
  );
}
