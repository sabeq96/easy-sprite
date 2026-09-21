import { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  estimateStorage,
  isStoragePersisted,
  requestPersistentStorage,
  type StorageEstimate,
} from "@/lib/storage";
import { formatBytes } from "@/lib/validation";

export function StorageSection() {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  const [persisted, setPersisted] = useState(false);

  useEffect(() => {
    void estimateStorage().then(setEstimate);
    void isStoragePersisted().then(setPersisted);
  }, []);

  const requestPersist = async () => {
    const granted = await requestPersistentStorage();
    setPersisted(granted);
    toast[granted ? "success" : "error"](
      granted
        ? "Your sprites are protected from automatic cleanup."
        : "The browser declined persistent storage.",
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <HardDrive className="size-4" />
          Storage
        </CardTitle>
        <CardDescription>
          {estimate
            ? `${formatBytes(estimate.usedBytes)} used of ${formatBytes(estimate.quotaBytes)} available.`
            : "This browser does not report storage usage."}
        </CardDescription>
      </CardHeader>

      <CardContent gap="md" className="flex flex-col">
        {estimate && (
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(estimate.percent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Storage used"
          >
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${Math.min(100, Math.max(1, estimate.percent))}%` }}
            />
          </div>
        )}

        {persisted ? (
          <p className="text-sm text-muted-foreground">
            Persistent storage is on — the browser will not evict your sprites automatically.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Without persistent storage the browser may delete your sprites when disk space runs
              low.
            </p>
            <Button size="sm" variant="outline" onClick={requestPersist}>
              Keep my sprites
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
