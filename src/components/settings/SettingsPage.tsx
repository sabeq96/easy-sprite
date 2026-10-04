import { BackupSection } from "@/components/settings/BackupSection";
import { DefaultsSection } from "@/components/settings/DefaultsSection";
import { StorageSection } from "@/components/settings/StorageSection";
import { ThemeSection } from "@/components/settings/ThemeSection";

export function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">Settings</h1>
      <ThemeSection />
      <DefaultsSection />
      <StorageSection />
      <BackupSection />
    </div>
  );
}
