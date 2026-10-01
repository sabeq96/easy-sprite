import { Layers2 } from "lucide-react";
import { TooltipButton } from "@/components/common/TooltipButton";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useCommandKeys } from "@/commands/CommandsContext";
import { useAnimationStore } from "./store";

export function OnionSkinControl() {
  const onion = useAnimationStore((state) => state.onion);
  const setOnion = useAnimationStore((state) => state.setOnion);
  const toggleKeys = useCommandKeys("view.toggleOnion");

  return (
    <Popover>
      {/* Opens the settings; the tooltip still teaches the key that toggles it directly. */}
      <PopoverTrigger
        render={
          <TooltipButton
            label="Onion skin settings"
            shortcut={toggleKeys}
            variant={onion.enabled ? "secondary" : "ghost"}
            aria-pressed={onion.enabled}
          >
            <Layers2 />
          </TooltipButton>
        }
      />
      <PopoverContent gap="md" className="w-56">
        <Label size="sm" weight="normal" className="justify-between">
          Onion skin
          <Switch
            checked={onion.enabled}
            onCheckedChange={(checked) => setOnion({ enabled: checked })}
          />
        </Label>

        <Separator />

        <Label size="sm" weight="normal" className="justify-between">
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

        <Label size="sm" weight="normal" gap="sm" className="flex-col">
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
