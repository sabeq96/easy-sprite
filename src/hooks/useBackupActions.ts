import { toast } from "sonner";
import { clearAllData, exportBackup, importBackup, validateBackup } from "@/db/backup";
import { downloadJson } from "@/export/download";
import { runWithToast, useAsyncAction } from "@/hooks/useAsyncAction";
import { plural } from "@/lib/format";
import type { BackupFile, ImportMode } from "@/types/backup";

/** Whole-database backup, restore and wipe, with their user-facing feedback built in. */
export function useBackupActions() {
  const exportAll = useAsyncAction(
    async () => {
      const backup = await exportBackup();
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(backup, `sprite-editor-backup-${date}.json`);
      return backup;
    },
    { success: (backup) => `Exported ${plural(backup.counts.sprites, "sprite")}`, error: "Backup failed." },
  );

  /** Validates before anything touches the database; resolves to the backup, or null if rejected. */
  const readFile = async (file: File): Promise<BackupFile | null> => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast.error("That file is not valid JSON.");
      return null;
    }
    const validated = validateBackup(parsed);
    if (!validated.ok) {
      toast.error(validated.error);
      return null;
    }
    return validated.value;
  };

  const restore = async (backup: BackupFile, mode: ImportMode) => {
    const result = await runWithToast(() => importBackup(backup, mode), { error: "Import failed." });
    if (!result) return;
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { sprites, spritesheets, skipped } = result.value;
    const parts = [plural(sprites, "sprite")];
    if (spritesheets > 0) parts.push(plural(spritesheets, "spritesheet"));
    const imported = `Imported ${parts.join(", ")}`;
    toast.success(skipped > 0 ? `${imported} · kept ${skipped} existing` : imported);
  };

  const clearAll = () =>
    runWithToast(clearAllData, { success: () => "All data deleted", error: "Could not delete data." });

  return { exportAll, readFile, restore, clearAll };
}
