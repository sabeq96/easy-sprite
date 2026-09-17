import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useColorField } from "@/hooks/useColorField";
import { hsvToRgb, parseHex, rgbaToHex, rgbToHsv, type HSV, type RGBA } from "@/lib/color";

export interface ColorPickerPopoverProps {
  value: RGBA;
  onChange: (color: RGBA) => void;
  children: React.ReactElement;
}

export function ColorPickerPopover({ value, onChange, children }: ColorPickerPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger render={children} />
      <PopoverContent className="w-60">
        <ColorPickerBody value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}

function ColorPickerBody({ value, onChange }: { value: RGBA; onChange: (color: RGBA) => void }) {
  // HSV is local state: dragging hue through a fully desaturated colour must not lose the hue.
  const [hsv, setHsv] = useState<HSV>(() => rgbToHsv(value));
  const [alpha, setAlpha] = useState(value.a);
  const [hexDraft, setHexDraft] = useState<string | null>(null);

  useEffect(() => {
    // Re-sync only when the incoming colour is genuinely different from what we produce.
    if (rgbaToHex(hsvToRgb(hsv, alpha), true) === rgbaToHex(value, true)) return;
    setHsv(rgbToHsv(value));
    setAlpha(value.a);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncing from the prop only
  }, [value]);

  const commit = (nextHsv: HSV, nextAlpha: number) => {
    setHsv(nextHsv);
    setAlpha(nextAlpha);
    onChange(hsvToRgb(nextHsv, nextAlpha));
  };

  const square = useColorField((x, y) => commit({ ...hsv, s: x, v: 1 - y }, alpha));
  const hueStrip = useColorField((x) => commit({ ...hsv, h: x * 360 }, alpha));
  const alphaStrip = useColorField((x) => commit(hsv, Math.round(x * 255)));

  const hueColor = rgbaToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));
  const current = hsvToRgb(hsv, alpha);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={square.ref}
        onPointerDown={square.onPointerDown}
        onPointerMove={square.onPointerMove}
        className="relative h-32 w-full cursor-crosshair rounded-md"
        style={{
          backgroundColor: hueColor,
          backgroundImage:
            "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
        }}
      >
        <Marker left={`${hsv.s * 100}%`} top={`${(1 - hsv.v) * 100}%`} />
      </div>

      <div
        ref={hueStrip.ref}
        onPointerDown={hueStrip.onPointerDown}
        onPointerMove={hueStrip.onPointerMove}
        className="relative h-3 w-full cursor-pointer rounded-full"
        style={{
          backgroundImage:
            "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
      >
        <Marker left={`${(hsv.h / 360) * 100}%`} top="50%" />
      </div>

      <div
        ref={alphaStrip.ref}
        onPointerDown={alphaStrip.onPointerDown}
        onPointerMove={alphaStrip.onPointerMove}
        className="relative h-3 w-full cursor-pointer rounded-full bg-checker-a"
        style={{
          backgroundImage: `linear-gradient(to right, transparent, ${rgbaToHex(current)})`,
        }}
      >
        <Marker left={`${(alpha / 255) * 100}%`} top="50%" />
      </div>

      <Label className="flex items-center gap-2 text-xs font-normal">
        Hex
        <Input
          className="h-7 font-mono text-xs"
          value={hexDraft ?? rgbaToHex(current, alpha !== 255)}
          onChange={(event) => {
            setHexDraft(event.target.value);
            const parsed = parseHex(event.target.value);
            if (parsed) commit(rgbToHsv(parsed), parsed.a);
          }}
          onBlur={() => setHexDraft(null)}
          onKeyDown={(event) => event.stopPropagation()}
        />
      </Label>
    </div>
  );
}

function Marker({ left, top }: { left: string; top: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm ring-1 ring-black/40"
      style={{ left, top }}
    />
  );
}
