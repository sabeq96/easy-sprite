import { useState } from "react";
import { Crop, Menu, Save } from "lucide-react";
import { toast } from "sonner";
import { useDocumentSession } from "@/app/DocumentProvider";
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
  const { autosave } = useDocumentSession();
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
          {/* Export is not here: it is a primary action, so it has its own button in the bar. */}
          <DropdownMenuItem onClick={() => setResizing(true)}>
            <Crop />
            Resize canvas…
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

      <ResizeCanvasDialog open={isResizing} onOpenChange={setResizing} />
    </>
  );
}
