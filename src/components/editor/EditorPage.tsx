import { useParams } from "react-router";
import { DocumentProvider } from "@/app/DocumentProvider";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { EditorLoadError } from "@/components/editor/EditorLoadError";
import { EditorSkeleton } from "@/components/editor/EditorSkeleton";
import { EditorStatusBar } from "@/components/editor/EditorStatusBar";
import { EditorTopBar } from "@/components/editor/EditorTopBar";
import { NotFoundPage } from "@/components/common/NotFoundPage";
import { useActiveTargets } from "@/hooks/useActiveTargets";

export function EditorPage() {
  const { spriteId } = useParams<{ spriteId: string }>();
  if (!spriteId) return <NotFoundPage />;

  return (
    <DocumentProvider
      spriteId={spriteId}
      fallback={<EditorSkeleton />}
      renderError={(message) => <EditorLoadError message={message} />}
    >
      <EditorShell />
    </DocumentProvider>
  );
}

/** Layout only — every panel owns its own state and subscriptions. */
function EditorShell() {
  useActiveTargets();

  return (
    <div className="grid h-dvh grid-rows-[2.5rem_1fr_1.75rem] overflow-hidden">
      <EditorTopBar />
      <div className="grid min-h-0 grid-cols-[1fr]">
        <EditorCanvas />
      </div>
      <EditorStatusBar />
    </div>
  );
}
