export interface StorageEstimate {
  usedBytes: number;
  quotaBytes: number;
  percent: number;
}

/** Null where the API is unavailable (older Safari, Firefox private mode). */
export async function estimateStorage(): Promise<StorageEstimate | null> {
  if (!navigator.storage?.estimate) return null;

  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usedBytes: usage, quotaBytes: quota, percent: quota ? (usage / quota) * 100 : 0 };
}

/**
 * Without persistent storage the browser may evict IndexedDB under pressure, which for a
 * local-only app means silent data loss.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export async function isStoragePersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false;
  return navigator.storage.persisted();
}
