import { useRef, useState } from "react";
import {
  ArrowDownUp,
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NameDialog } from "@/components/common/NameDialog";
import { DEFAULT_PALETTE_NAME } from "@/constants/names";
import type { PaletteRecord } from "@/db/schema";
import { collectColorUsage } from "@/editor/colorUsage";
import { usePaletteActions } from "@/hooks/usePaletteActions";

export function PaletteMenu({ palette }: { palette: PaletteRecord | null }) {
  const { doc } = useDocumentSession();
  const actions = usePaletteActions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isCreating, setCreating] = useState(false);
  const [isRenaming, setRenaming] = useState(false);

  /** A click handler that acts on the active palette, and does nothing without one. */
  const onPalette = (run: (active: PaletteRecord) => unknown) => () => {
    if (palette) void run(palette);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="icon-sm" variant="ghost" aria-label="Palette actions">
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onClick={() => setCreating(true)}>
            <Plus />
            New palette
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!palette} onClick={onPalette(actions.duplicate)}>
            <Copy />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!palette} onClick={() => setRenaming(true)}>
            <Pencil />
            Rename…
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!palette} onClick={onPalette((active) =>
              actions.addColors(active, collectColorUsage(doc).map((entry) => entry.hex)),
            )}>
            <Wand2 />
            Add colors from sprite
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!palette || palette.colors.length < 2} onClick={onPalette(actions.sortByHue)}>
            <ArrowDownUp />
            Auto-sort colors
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem disabled={!palette} onClick={onPalette(actions.exportGpl)}>
            <Download />
            Export .gpl
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            <Upload />
            Import .gpl / .hex
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            disabled={!palette}
            onClick={onPalette(actions.remove)}
          >
            <Trash2 />
            Delete palette
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileRef}
        type="file"
        accept=".gpl,.hex,.txt"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void actions.importFile(file);
          event.target.value = "";
        }}
      />

      <NameDialog
        open={isCreating}
        onOpenChange={setCreating}
        title="New palette"
        description="Name your palette. You can rename it later."
        submitLabel="Create"
        namePlaceholder={DEFAULT_PALETTE_NAME}
        requireName
        onSubmit={({ name }) => actions.create(name)}
      />
      <NameDialog
        open={isRenaming}
        onOpenChange={setRenaming}
        title="Rename palette"
        description="Choose a new name for this palette."
        submitLabel="Save"
        initialName={palette?.name}
        requireName
        onSubmit={({ name }) => palette && actions.rename(palette, name)}
      />
    </>
  );
}
