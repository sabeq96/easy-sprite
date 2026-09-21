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
import { toast } from "sonner";
import { useDocumentSession } from "@/app/DocumentProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaletteNameDialog } from "@/components/editor/PaletteNameDialog";
import { createPalette, removePalette, updatePalette } from "@/db/repositories/palettes";
import type { PaletteRecord } from "@/db/schema";
import { collectColorUsage } from "@/editor/colorUsage";
import { downloadBlob } from "@/export/download";
import { hexToRgba } from "@/lib/color";
import { parsePaletteFile, toGpl } from "@/lib/paletteFormats";
import { sortColorsByHue } from "@/lib/paletteSort";
import { useEditorStore } from "@/stores/useEditorStore";

export function PaletteMenu({ palette }: { palette: PaletteRecord | null }) {
  const { doc } = useDocumentSession();
  const setActivePalette = useEditorStore((state) => state.setActivePalette);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isCreating, setCreating] = useState(false);
  const [isRenaming, setRenaming] = useState(false);

  const create = async (name: string) => {
    const created = await createPalette(name, []);
    setActivePalette(created.id);
  };

  const rename = async (name: string) => {
    if (!palette) return;
    await updatePalette(palette.id, { name });
  };

  const duplicate = async () => {
    if (!palette) return;
    const copy = await createPalette(`${palette.name} copy`, [...palette.colors]);
    setActivePalette(copy.id);
  };

  const addSpriteColors = async () => {
    if (!palette) return;
    const used = collectColorUsage(doc).map((entry) => entry.hex);
    const merged = [...new Set([...palette.colors, ...used])];
    await updatePalette(palette.id, { colors: merged });
    toast.success(`Added ${merged.length - palette.colors.length} colors`);
  };

  const autoSort = async () => {
    if (!palette) return;
    await updatePalette(palette.id, { colors: sortColorsByHue(palette.colors) });
    toast.success("Sorted by hue");
  };

  const exportGpl = () => {
    if (!palette) return;
    const text = toGpl(palette.name, palette.colors.map(hexToRgba));
    downloadBlob(new Blob([text], { type: "text/plain" }), `${palette.name}.gpl`);
  };

  const importFile = async (file: File) => {
    const parsed = parsePaletteFile(file.name, await file.text());
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    const created = await createPalette(file.name.replace(/\.[^.]+$/, ""), parsed.value);
    setActivePalette(created.id);
    toast.success(`Imported ${parsed.value.length} colors`);
  };

  const remove = async () => {
    if (!palette) return;
    try {
      await removePalette(palette.id);
      setActivePalette(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete that palette.");
    }
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
          <DropdownMenuItem disabled={!palette} onClick={duplicate}>
            <Copy />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!palette} onClick={() => setRenaming(true)}>
            <Pencil />
            Rename…
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!palette} onClick={addSpriteColors}>
            <Wand2 />
            Add colors from sprite
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!palette || palette.colors.length < 2} onClick={autoSort}>
            <ArrowDownUp />
            Auto-sort colors
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem disabled={!palette} onClick={exportGpl}>
            <Download />
            Export .gpl
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            <Upload />
            Import .gpl / .hex
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" disabled={!palette} onClick={remove}>
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
          if (file) void importFile(file);
          event.target.value = "";
        }}
      />

      <PaletteNameDialog
        key={isCreating ? "creating" : "not-creating"}
        open={isCreating}
        onOpenChange={setCreating}
        title="New palette"
        description="Name your palette. You can rename it later."
        confirmLabel="Create"
        onConfirm={(name) => void create(name)}
      />
      <PaletteNameDialog
        key={isRenaming ? "renaming" : "not-renaming"}
        open={isRenaming}
        onOpenChange={setRenaming}
        title="Rename palette"
        description="Choose a new name for this palette."
        initialName={palette?.name ?? ""}
        confirmLabel="Save"
        onConfirm={(name) => void rename(name)}
      />
    </>
  );
}
