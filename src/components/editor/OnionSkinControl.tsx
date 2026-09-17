import { Layers2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { shortcutHint } from "@/constants/shortcuts";
import { useEditorStore } from "@/stores/useEditorStore";

export function OnionSkinControl() {
  const onion = useEditorStore((state) => state.onion);
  const setOnion = useEditorStore((state) => state.setOnion);
  const shortcut = shortcutHint("view.toggleOnion");

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
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
        </TooltipTrigger>
        <TooltipContent>
          Onion skin settings
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="flex w-56 flex-col gap-3">
        <Label className="flex items-center justify-between gap-2 text-xs font-normal">
          Onion skin
          <Switch
            checked={onion.enabled}
            onCheckedChange={(checked) => setOnion({ enabled: checked })}
          />
        </Label>

        <Separator />

        <Label className="flex items-center justify-between gap-2 text-xs font-normal">
          <span className={onion.direction === "before" ? "text-foreground" : "text-muted-foreground"}>
            Before
          </span>
          <Switch
            checked={onion.direction === "after"}
            onCheckedChange={(checked) => setOnion({ direction: checked ? "after" : "before" })}
            aria-label="Onion skin direction"
          />
          <span className={onion.direction === "after" ? "text-foreground" : "text-muted-foreground"}>
            After
          </span>
        </Label>

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
      </PopoverContent>
    </Popover>
  );
}
