import { useState } from "react";
import { useSpritesheetSession } from "@/app/SpritesheetProvider";
import { TileSizePicker } from "@/components/common/TileSizePicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setTileSizeCommand } from "@/editor/commands/spritesheet";

export interface TileSizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The sheet's counterpart to Resize canvas: its only size is its tile. */
export function TileSizeDialog({ open, onOpenChange }: TileSizeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so the draft initialises from the document. */}
        {open && <TileSizeForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function TileSizeForm({ onDone }: { onDone: () => void }) {
  const { doc, history } = useSpritesheetSession();
  const [tile, setTile] = useState(doc.tileSize);

  const apply = () => {
    const command = setTileSizeCommand(doc, tile);
    if (command) history.push(command);
    onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Tile size</DialogTitle>
        <DialogDescription>
          Sets the grid the sheet opens with. Sprites on the sheet are not changed.
        </DialogDescription>
      </DialogHeader>

      <TileSizePicker value={tile} onChange={setTile} />

      <DialogFooter>
        <DialogClose render={<Button variant="ghost">Cancel</Button>} />
        <Button onClick={apply} disabled={tile === doc.tileSize}>
          Apply
        </Button>
      </DialogFooter>
    </>
  );
}
