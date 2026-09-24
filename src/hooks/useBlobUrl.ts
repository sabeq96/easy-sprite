import { useEffect, useState } from "react";

/**
 * Object URLs must be revoked or the tab leaks memory as the gallery scrolls — doing it in one
 * hook makes that impossible to forget.
 *
 * An effect is the right tool despite the set-state-in-effect rule: createObjectURL allocates a
 * browser resource with a matching release call, so it cannot run during render.
 */
/* eslint-disable react/set-state-in-effect -- syncing with an external browser resource */
export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return url;
}
/* eslint-enable react/set-state-in-effect */
