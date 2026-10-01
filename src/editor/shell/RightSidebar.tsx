import { Panel } from "@/components/common/Panel";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { PalettePanel } from "@/components/editor/PalettePanel";
import { PreviewPanel } from "@/components/editor/PreviewPanel";
import { ScrollArea } from "@/components/ui/scroll-area";

export function RightSidebar() {
  return (
    <aside className="flex min-h-0 flex-col gap-2">
      <PreviewPanel />
      {/* The palette can grow long; layers keep their own scroll area below it. */}
      <Panel render={<ScrollArea />} className="max-h-[40%] shrink-0">
        <PalettePanel />
      </Panel>
      <LayersPanel />
    </aside>
  );
}
