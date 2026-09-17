import { Grid3x3, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { TooltipButton } from "@/components/common/TooltipButton";
import { OnionSkinControl } from "@/components/editor/OnionSkinControl";
import { Separator } from "@/components/ui/separator";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { useEditorStore } from "@/stores/useEditorStore";

export function ViewControls() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);
  const gridEnabled = useEditorStore((state) => state.gridEnabled);
  const toggleGrid = useEditorStore((state) => state.toggleGrid);
  const zoom = useEditorStore((state) => state.zoom);
  const containerSize = useEditorStore((state) => state.containerSize);
  const fitToContainer = useEditorStore((state) => state.fitToContainer);

  const sprite = { width: snapshot.width, height: snapshot.height };
  const centre = { x: containerSize.width / 2, y: containerSize.height / 2 };

  const buttons = [
    { label: "Zoom out", shortcut: "-", icon: ZoomOut, run: () => zoom(centre, -1, sprite) },
    { label: "Zoom in", shortcut: "+", icon: ZoomIn, run: () => zoom(centre, 1, sprite) },
    {
      label: "Fit to window",
      shortcut: "0",
      icon: Maximize,
      run: () => fitToContainer(containerSize, sprite),
    },
  ];

  return (
    <div className="flex items-center gap-0.5">
      {buttons.map(({ label, shortcut, icon: Icon, run }) => (
        <TooltipButton key={label} label={label} shortcut={shortcut} onClick={run}>
          <Icon />
        </TooltipButton>
      ))}

      <TooltipButton
        label="Toggle pixel grid"
        variant={gridEnabled ? "secondary" : "ghost"}
        aria-pressed={gridEnabled}
        onClick={toggleGrid}
      >
        <Grid3x3 />
      </TooltipButton>

      <Separator orientation="vertical" className="mx-1 h-5" />
      <OnionSkinControl />
    </div>
  );
}
