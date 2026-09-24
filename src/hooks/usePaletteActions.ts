import { toast } from "sonner";
import { createPalette, removePalette, updatePalette } from "@/db/repositories/palettes";
import type { PaletteRecord } from "@/db/schema";
import { downloadBlob } from "@/export/download";
import { runWithToast } from "@/hooks/useAsyncAction";
import { hexToRgba } from "@/lib/color";
import { plural } from "@/lib/format";
import { parsePaletteFile, toGpl } from "@/lib/paletteFormats";
import { sortColorsByHue } from "@/lib/paletteSort";
import { useEditorStore } from "@/stores/useEditorStore";

/** Every palette mutation the UI can start. Creating one also makes it the active palette. */
export function usePaletteActions() {
  const setActivePalette = useEditorStore((state) => state.setActivePalette);

  const createActive = async (name: string, colors: string[]) => {
    const created = await createPalette(name, colors);
    setActivePalette(created.id);
    return created;
  };

  return {
    create: (name: string) => createActive(name, []),

    duplicate: (palette: PaletteRecord) => createActive(`${palette.name} copy`, [...palette.colors]),

    rename: (palette: PaletteRecord, name: string) => updatePalette(palette.id, { name }),

    setColors: (palette: PaletteRecord, colors: string[]) => updatePalette(palette.id, { colors }),

    addColors: async (palette: PaletteRecord, colors: string[]) => {
      const merged = [...new Set([...palette.colors, ...colors])];
      await updatePalette(palette.id, { colors: merged });
      toast.success(`Added ${plural(merged.length - palette.colors.length, "color")}`);
    },

    sortByHue: async (palette: PaletteRecord) => {
      await updatePalette(palette.id, { colors: sortColorsByHue(palette.colors) });
      toast.success("Sorted by hue");
    },

    exportGpl: (palette: PaletteRecord) => {
      const text = toGpl(palette.name, palette.colors.map(hexToRgba));
      downloadBlob(new Blob([text], { type: "text/plain" }), `${palette.name}.gpl`);
    },

    importFile: async (file: File) => {
      const parsed = parsePaletteFile(file.name, await file.text());
      if (!parsed.ok) {
        toast.error(parsed.error);
        return;
      }
      await createActive(file.name.replace(/\.[^.]+$/, ""), parsed.value);
      toast.success(`Imported ${plural(parsed.value.length, "color")}`);
    },

    remove: (palette: PaletteRecord) =>
      runWithToast(
        async () => {
          await removePalette(palette.id);
          setActivePalette(null);
        },
        { error: "Could not delete that palette." },
      ),
  };
}
