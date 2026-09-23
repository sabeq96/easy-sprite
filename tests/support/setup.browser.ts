import { afterEach } from "vitest";
import { DB_NAME } from "@/constants/storage";
import { db } from "@/db/db";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";
import { useCursorStore } from "@/stores/useCursorStore";
import { useEditorStore } from "@/stores/useEditorStore";
// Component tests never go through main.tsx, so nothing else loads Tailwind's base layer —
// without it, Base UI's dialog overlay has no z-index/positioning and can sit on top of and
// intercept clicks meant for the dialog's own content.
import "@/index.css";

afterEach(async () => {
  // These are app-wide singletons, so the active tool, color and viewport from one test would
  // otherwise leak into the next — a fresh per-test store isn't an option here since components
  // import the singleton directly, not through a hook that could be swapped in tests.
  useEditorStore.setState(useEditorStore.getInitialState(), true);
  useCursorStore.setState(useCursorStore.getInitialState(), true);
  useBuilderViewStore.setState(useBuilderViewStore.getInitialState(), true);

  // `db` is a module-level singleton that stays open across every test in this file. Deleting
  // the database while it is still open leaves the delete request queued ("blocked") behind it,
  // racing the next test's own queries against a database that vanishes underneath them — so
  // the connection is closed first and the delete is awaited to completion before moving on.
  // An explicit `close()` does not auto-reopen the way an unexpected close does, so the next
  // test would see every query fail with DatabaseClosedError without the `open()` below.
  db.close();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error as Error);
    request.onblocked = () => resolve();
  });
  await db.open();
});
