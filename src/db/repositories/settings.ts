import { db } from "@/db/db";
import { withQuotaGuard } from "@/db/errors";

export async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export function writeSetting<T>(key: string, value: T): Promise<string> {
  return withQuotaGuard(() => db.settings.put({ key, value }));
}

export function listSettings() {
  return db.settings.toArray();
}
