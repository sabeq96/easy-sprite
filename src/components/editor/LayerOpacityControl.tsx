import { useDocumentSession } from "@/app/DocumentProvider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { setLayerPropsCommand } from "@/editor/commands/layers";
import type { LayerModel } from "@/editor/document";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";

export function LayerOpacityControl({ layer }: { layer: LayerModel }) {
  const { doc } = useDocumentSession();
  const dispatch = useCommandDispatch();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="xs"
            variant="ghost"
            aria-label={`Opacity of ${layer.name}`}
            className="w-9 tabular-nums"
          >
            {Math.round(layer.opacity * 100)}
          </Button>
        }
      />
      <PopoverContent className="w-48">
        <Slider
          min={0}
          max={100}
          value={[Math.round(layer.opacity * 100)]}
          aria-label="Layer opacity"
          // Live while dragging so the canvas follows the slider…
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value;
            doc.setLayerProps(layer.id, { opacity: next / 100 });
          }}
          // …but only one undo entry, recorded on release.
          onValueCommitted={(value) => {
            const next = Array.isArray(value) ? value[0] : value;
            dispatch(() =>
              setLayerPropsCommand(doc, layer.id, { opacity: next / 100 }, "Change opacity"),
            );
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
