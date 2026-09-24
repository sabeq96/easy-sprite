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

const SAVE_FAILED = "Could not save the palette.";

/**
 * Every palette mutation the UI can start. Creating one also makes it the active palette. Each one
 * reports its own failure and then resolves to `undefined`, so callers never catch.
 */
export function usePaletteActions() {
  const setActivePalette = useEditorStore((state) => state.setActivePalette);

  const createActive = (name: string, colors: string[], success?: string) =>
    runWithToast(
      async () => {
        const created = await createPalette(name, colors);
        setActivePalette(created.id);
        return created;
      },
      { success: () => success, error: "Could not create the palette." },
    );

  const update = (
    palette: PaletteRecord,
    patch: { name?: string; colors?: string[] },
    success?: string,
  ) => runWithToast(() => updatePalette(palette.id, patch), { success: () => success, error: SAVE_FAILED });

  return {
    create: (name: string) => createActive(name, []),

    duplicate: (palette: PaletteRecord) => createActive(`${palette.name} copy`, [...palette.colors]),

    rename: (palette: PaletteRecord, name: string) => update(palette, { name }),

    setColors: (palette: PaletteRecord, colors: string[]) => update(palette, { colors }),

    addColors: (palette: PaletteRecord, colors: string[]) => {
      const merged = [...new Set([...palette.colors, ...colors])];
      return update(
        palette,
        { colors: merged },
        `Added ${plural(merged.length - palette.colors.length, "color")}`,
      );
    },

    sortByHue: (palette: PaletteRecord) =>
      update(palette, { colors: sortColorsByHue(palette.colors) }, "Sorted by hue"),

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
      await createActive(
        file.name.replace(/\.[^.]+$/, ""),
        parsed.value,
        `Imported ${plural(parsed.value.length, "color")}`,
      );
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
