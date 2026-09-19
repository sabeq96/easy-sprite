import { FlipHorizontal, FlipVertical } from "lucide-react";
import type { ToolId } from "@/constants/tools";
import { BRUSH_SIZES } from "@/constants/tools";
import { TOOLS } from "@/editor/tools";
import { Panel } from "@/components/common/Panel";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/stores/useEditorStore";

type OptionField = "brushSize" | "mirror" | "pickSource";

/** Declarative per-tool option list beats a chain of conditionals in the JSX. */
const TOOL_OPTION_FIELDS: Record<ToolId, readonly OptionField[]> = {
  pencil: ["brushSize", "mirror"],
  eraser: ["brushSize"],
  bucket: [],
  fillSimilar: [],
  picker: ["pickSource"],
  select: [],
  move: [],
};

export function ToolOptionsBar() {
  const toolId = useEditorStore((state) => state.toolId);
  const options = useEditorStore((state) => state.toolOptions);
  const setToolOptions = useEditorStore((state) => state.setToolOptions);

  const fields = TOOL_OPTION_FIELDS[toolId];

  return (
    <Panel className="flex h-9 items-center gap-3 px-3 text-xs">
      <span className="font-medium">{TOOLS[toolId].label}</span>
      {fields.length > 0 && <Separator orientation="vertical" className="h-4" />}

      {fields.includes("brushSize") && (
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground">Size</Label>
          <ToggleGroup
            value={[String(options.brushSize)]}
            onValueChange={([value]) => {
              if (value) setToolOptions({ brushSize: Number(value) });
            }}
            aria-label="Brush size"
          >
            {BRUSH_SIZES.map((size) => (
              <Toggle key={size} value={String(size)} size="sm" aria-label={`${size} pixels`}>
                {size}
              </Toggle>
            ))}
          </ToggleGroup>
        </div>
      )}

      {fields.includes("mirror") && (
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">Mirror</Label>
          <Button
            size="icon-xs"
            variant={options.mirrorHorizontal ? "secondary" : "ghost"}
            aria-label="Mirror horizontally"
            aria-pressed={options.mirrorHorizontal}
            onClick={() => setToolOptions({ mirrorHorizontal: !options.mirrorHorizontal })}
          >
            <FlipHorizontal />
          </Button>
          <Button
            size="icon-xs"
            variant={options.mirrorVertical ? "secondary" : "ghost"}
            aria-label="Mirror vertically"
            aria-pressed={options.mirrorVertical}
            onClick={() => setToolOptions({ mirrorVertical: !options.mirrorVertical })}
          >
            <FlipVertical />
          </Button>
        </div>
      )}

      {fields.includes("pickSource") && (
        <Label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch
            checked={options.pickFromComposite}
            onCheckedChange={(checked) => setToolOptions({ pickFromComposite: checked })}
          />
          Sample merged image
        </Label>
      )}
    </Panel>
  );
}
