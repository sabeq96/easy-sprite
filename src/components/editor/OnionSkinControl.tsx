import { Layers2 } from "lucide-react";
import { NumberField } from "@/components/common/NumberField";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ONION_MAX_FRAMES } from "@/constants/animation";
import { useEditorStore } from "@/stores/useEditorStore";

export function OnionSkinControl() {
  const onion = useEditorStore((state) => state.onion);
  const setOnion = useEditorStore((state) => state.setOnion);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="icon-sm"
            variant={onion.enabled ? "secondary" : "ghost"}
            aria-label="Onion skin settings"
            aria-pressed={onion.enabled}
          >
            <Layers2 />
          </Button>
        }
      />
      <PopoverContent className="flex w-56 flex-col gap-3">
        <Label className="flex items-center justify-between gap-2 text-xs font-normal">
          Onion skin
          <Switch
            checked={onion.enabled}
            onCheckedChange={(checked) => setOnion({ enabled: checked })}
          />
        </Label>

        <Separator />

        <NumberField
          label="Frames before"
          min={0}
          max={ONION_MAX_FRAMES}
          value={onion.before}
          onChange={(before) => setOnion({ before })}
        />
        <NumberField
          label="Frames after"
          min={0}
          max={ONION_MAX_FRAMES}
          value={onion.after}
          onChange={(after) => setOnion({ after })}
        />

        <Label className="flex flex-col gap-1.5 text-xs font-normal">
          Opacity
          <Slider
            min={10}
            max={80}
            value={[Math.round(onion.opacity * 100)]}
            aria-label="Onion skin opacity"
            onValueChange={(value) =>
              setOnion({ opacity: (Array.isArray(value) ? value[0] : value) / 100 })
            }
          />
        </Label>

        <Label className="flex items-center justify-between gap-2 text-xs font-normal">
          Tint red / blue
          <Switch
            checked={onion.tint}
            onCheckedChange={(checked) => setOnion({ tint: checked })}
          />
        </Label>
      </PopoverContent>
    </Popover>
  );
}
