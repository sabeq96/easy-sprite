import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
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
import { useBackupActions } from "@/hooks/useBackupActions";
import type { BackupFile, ImportMode } from "@/types/backup";

export function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const backup = useBackupActions();
  // Shown in the import dialog before anything touches the database.
  const [pending, setPending] = useState<BackupFile | null>(null);

  const readFile = async (file: File) => setPending(await backup.readFile(file));

  const runImport = async (mode: ImportMode) => {
    if (!pending) return;
    await backup.restore(pending, mode);
    setPending(null);
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
        <Button
          variant="outline"
          onClick={() => void backup.exportAll.run()}
          disabled={backup.exportAll.isRunning}
        >
          <Download />
          {backup.exportAll.isRunning ? "Exporting…" : "Export backup"}
        </Button>

        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload />
          Import backup
        </Button>

        <ConfirmDialog
          title="Delete all data?"
          description="This permanently removes every sprite, spritesheet, layer and palette from this browser, and restores the starter palettes. Export a backup first."
          confirmLabel="Delete everything"
          destructive
          onConfirm={() => void backup.clearAll()}
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
