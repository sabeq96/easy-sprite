import { useState } from "react";
import { Crop, Menu, Save } from "lucide-react";
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
import { useCommand } from "@/commands/CommandsContext";
import { commandKeys } from "@/commands/keymap";

export function EditorMenu() {
  const save = useCommand("edit.save");
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

          <DropdownMenuItem onClick={save.run}>
            <Save />
            {save.label}
            <DropdownMenuShortcut>{commandKeys("edit.save").join(" ")}</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResizeCanvasDialog open={isResizing} onOpenChange={setResizing} />
    </>
  );
}
