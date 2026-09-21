import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clearAllData, exportBackup, importBackup, validateBackup } from "@/db/backup";
import { downloadJson } from "@/export/download";
import type { BackupFile, ImportMode } from "@/types/backup";

export function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isExporting, setExporting] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);

  const runExport = async () => {
    setExporting(true);
    try {
      const backup = await exportBackup();
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(backup, `sprite-editor-backup-${date}.json`);
      toast.success(`Exported ${backup.counts.sprites} sprites`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Backup failed.");
    } finally {
      setExporting(false);
    }
  };

  const readFile = async (file: File) => {
    try {
      // Validate before touching the database, and show what is in the file first.
      const parsed: unknown = JSON.parse(await file.text());
      const validated = validateBackup(parsed);
      if (!validated.ok) {
        toast.error(validated.error);
        return;
      }
      setPending(validated.value);
    } catch {
      toast.error("That file is not valid JSON.");
    }
  };

  const runImport = async (mode: ImportMode) => {
    if (!pending) return;
    const result = await importBackup(pending, mode);
    setPending(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { sprites, skipped } = result.value;
    toast.success(
      skipped > 0
        ? `Imported ${sprites} sprites · kept ${skipped} existing`
        : `Imported ${sprites} sprites`,
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup</CardTitle>
        <CardDescription>
          Everything is stored in this browser. Export a JSON backup to move it elsewhere.
        </CardDescription>
      </CardHeader>

      <CardContent gap="sm" className="flex flex-wrap">
        <Button variant="outline" onClick={runExport} disabled={isExporting}>
          <Download />
          {isExporting ? "Exporting…" : "Export backup"}
        </Button>

        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload />
          Import backup
        </Button>

        <ConfirmDialog
          title="Delete all sprites?"
          description="This permanently removes every sprite, layer and user palette from this browser. Export a backup first."
          confirmLabel="Delete everything"
          destructive
          onConfirm={() => {
            void clearAllData().then(() => toast.success("All data deleted"));
          }}
        >
          <Button variant="destructive">Delete all data</Button>
        </ConfirmDialog>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = "";
          }}
        />

        <ImportDialog
          backup={pending}
          onCancel={() => setPending(null)}
          onConfirm={runImport}
        />
      </CardContent>
    </Card>
  );
}

interface ImportDialogProps {
  backup: BackupFile | null;
  onCancel: () => void;
  onConfirm: (mode: ImportMode) => void;
}

function ImportDialog({ backup, onCancel, onConfirm }: ImportDialogProps) {
  return (
    <Dialog open={backup !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import backup</DialogTitle>
          <DialogDescription>
            {backup
              ? `${backup.counts.sprites} sprites, ${backup.counts.palettes} palettes, exported ${new Date(backup.exportedAt).toLocaleString()}.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Merge</strong> keeps your existing sprites and adds
          new ones. <strong className="text-foreground">Replace</strong> deletes everything here
          first.
        </p>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button variant="outline" onClick={() => onConfirm("merge")}>
            Merge
          </Button>
          <ConfirmDialog
            title="Replace everything?"
            description="Every sprite currently in this browser will be deleted and replaced by the backup."
            confirmLabel="Replace everything"
            destructive
            onConfirm={() => onConfirm("replace")}
          >
            <Button variant="destructive">Replace everything</Button>
          </ConfirmDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
