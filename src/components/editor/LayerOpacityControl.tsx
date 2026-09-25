import { useRef } from "react";
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
  // The opacity before this slider gesture began. The live updates below overwrite it in the
  // document, so the undo entry recorded on release has to be handed the original back.
  const gestureStart = useRef<number | null>(null);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="xs"
            variant="ghost"
            aria-label={`Opacity of ${layer.name}`}
            className="w-9"
            numeric
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
            gestureStart.current ??= doc.getLayer(layer.id)?.opacity ?? null;
            doc.setLayerProps(layer.id, { opacity: next / 100 });
          }}
          // …but only one undo entry, recorded on release, from where the gesture started.
          onValueCommitted={(value) => {
            const next = (Array.isArray(value) ? value[0] : value) / 100;
            const start = gestureStart.current;
            gestureStart.current = null;
            if (start !== null) doc.setLayerProps(layer.id, { opacity: start });
            if (start === next) return;
            dispatch(() => setLayerPropsCommand(doc, layer.id, { opacity: next }, "Change opacity"));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
