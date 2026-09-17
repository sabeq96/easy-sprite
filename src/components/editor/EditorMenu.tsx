import { useState } from "react";
import { Crop, Download, Menu, Save } from "lucide-react";
import { toast } from "sonner";
import { useDocumentSession } from "@/app/DocumentProvider";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { ResizeCanvasDialog } from "@/components/editor/ResizeCanvasDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { shortcutHint } from "@/constants/shortcuts";

export function EditorMenu() {
  const { doc, autosave } = useDocumentSession();
  const [isExporting, setExporting] = useState(false);
  const [isResizing, setResizing] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="icon-sm" variant="ghost" aria-label="Sprite menu">
              <Menu />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuItem onClick={() => setResizing(true)}>
            <Crop />
            Resize canvas…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setExporting(true)}>
            <Download />
            Export spritesheet…
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => void autosave.flush().then(() => toast.success("Saved"))}
          >
            <Save />
            Save now
            <DropdownMenuShortcut>{shortcutHint("edit.save")}</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ExportDialog
        doc={doc}
        open={isExporting}
        onOpenChange={setExporting}
        onBeforeExport={() => autosave.flush()}
      />
      <ResizeCanvasDialog open={isResizing} onOpenChange={setResizing} />
    </>
  );
}
