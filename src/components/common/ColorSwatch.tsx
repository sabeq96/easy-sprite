import { rgbaToHex, type RGBA } from "@/lib/color";
import { cn } from "@/lib/utils";

export interface ColorSwatchProps {
  color: RGBA;
  isActive?: boolean;
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
  size = "md",
  onPick,
  onPickSecondary,
}: ColorSwatchProps) {
  const hex = rgbaToHex(color, true);

  return (
    <button
      type="button"
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
    </button>
  );
}
