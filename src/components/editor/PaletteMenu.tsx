import { useRef } from "react";
import { Copy, Download, MoreHorizontal, Plus, Trash2, Upload, Wand2 } from "lucide-react";
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
import { createPalette, removePalette, updatePalette } from "@/db/repositories/palettes";
import type { PaletteRecord } from "@/db/schema";
import { collectColorUsage } from "@/editor/colorUsage";
import { downloadBlob } from "@/export/download";
import { hexToRgba } from "@/lib/color";
import { parsePaletteFile, toGpl } from "@/lib/paletteFormats";
import { useEditorStore } from "@/stores/useEditorStore";

export function PaletteMenu({ palette }: { palette: PaletteRecord | null }) {
  const { doc } = useDocumentSession();
  const setActivePalette = useEditorStore((state) => state.setActivePalette);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = async () => {
    const created = await createPalette("New palette", []);
    setActivePalette(created.id);
  };

  const duplicate = async () => {
    if (!palette) return;
    // The only way to "edit" a built-in.
    const copy = await createPalette(`${palette.name} copy`, [...palette.colors]);
    setActivePalette(copy.id);
  };

  const addSpriteColors = async () => {
    if (!palette || palette.builtIn) return;
    const used = collectColorUsage(doc).map((entry) => entry.hex);
    const merged = [...new Set([...palette.colors, ...used])];
    await updatePalette(palette.id, { colors: merged });
    toast.success(`Added ${merged.length - palette.colors.length} colors`);
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
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={create}>
            <Plus />
            New palette
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!palette} onClick={duplicate}>
            <Copy />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!palette || palette.builtIn} onClick={addSpriteColors}>
            <Wand2 />
            Add colors from sprite
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

          <DropdownMenuItem
            variant="destructive"
            disabled={!palette || palette.builtIn}
            onClick={remove}
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
          if (file) void importFile(file);
          event.target.value = "";
        }}
      />
    </>
  );
}
