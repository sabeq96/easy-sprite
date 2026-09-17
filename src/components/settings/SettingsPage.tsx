import { BackupSection } from "@/components/settings/BackupSection";
import { StorageSection } from "@/components/settings/StorageSection";
import { ThemeSection } from "@/components/settings/ThemeSection";

export function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">Settings</h1>
      <ThemeSection />
      <StorageSection />
      <BackupSection />
    </div>
  );
}
