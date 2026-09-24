export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoke on the next tick — revoking synchronously cancels the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadJson(value: unknown, filename: string): void {
  downloadBlob(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    filename,
  );
}

/** `Hero Walk` → `Hero Walk.png`: an export is named after the item, nothing more. */
export function pngFilename(name: string): string {
  return `${name.trim() || "Untitled"}.png`;
}
