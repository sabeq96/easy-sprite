import { useState } from "react";
import { Grid2x2, Menu, Save } from "lucide-react";
import { TileSizeDialog } from "@/components/builder/TileSizeDialog";
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

/** The composer's ☰ menu, mirroring the sprite editor's: its one size setting, and save. */
export function SpritesheetMenu() {
  const save = useCommand("edit.save");
  const [isEditingTile, setEditingTile] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="icon-sm" variant="ghost" aria-label="Spritesheet menu">
              <Menu />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuItem onClick={() => setEditingTile(true)}>
            <Grid2x2 />
            Tile size…
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={save.run}>
            <Save />
            {save.label}
            <DropdownMenuShortcut>{commandKeys("edit.save").join(" ")}</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TileSizeDialog open={isEditingTile} onOpenChange={setEditingTile} />
    </>
  );
}
