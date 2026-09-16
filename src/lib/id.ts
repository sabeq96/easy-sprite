/** Stable, collision-free ids so JSON backups re-import without remapping foreign keys. */
export function createId(): string {
  return crypto.randomUUID();
}
