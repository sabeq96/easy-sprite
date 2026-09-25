import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { History } from "@/editor/history";
import type { SpriteDocument } from "@/editor/document";
import { AutosaveController, type SaveStatus } from "@/services/autosave";
import { openDocument } from "@/services/documentService";

export interface DocumentSession {
  doc: SpriteDocument;
  history: History;
  autosave: AutosaveController;
  saveStatus: SaveStatus;
}

const DocumentContext = createContext<DocumentSession | null>(null);

type LoadState =
  | { status: "loading"; spriteId: string }
  | { status: "error"; spriteId: string; message: string }
  | {
      status: "ready";
      spriteId: string;
      doc: SpriteDocument;
      history: History;
      autosave: AutosaveController;
    };

export interface DocumentProviderProps {
  spriteId: string;
  children: ReactNode;
  fallback: ReactNode;
  renderError: (message: string) => ReactNode;
}

export function DocumentProvider({
  spriteId,
  children,
  fallback,
  renderError,
}: DocumentProviderProps) {
  const [state, setState] = useState<LoadState>({ status: "loading", spriteId });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Navigating to a different sprite resets during render rather than in an effect, so the
  // stale document is never shown for a frame.
  if (state.spriteId !== spriteId) setState({ status: "loading", spriteId });

  useEffect(() => {
    let disposed = false;
    let controller: AutosaveController | null = null;

    void openDocument(spriteId)
      .then((doc) => {
        if (disposed) return;
        controller = new AutosaveController(doc, setSaveStatus);
        const history = new History();
        // Dev-only handle: makes the live document inspectable from the console, and is how
        // tests/browser/** reaches real pixel state without a DOM-only assertion.
        if (import.meta.env.DEV) {
          Object.assign(window, { __spriteEditor: { doc, history, autosave: controller } });
        }
        setState({ status: "ready", spriteId, doc, history, autosave: controller });
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setState({
          status: "error",
          spriteId,
          message: error instanceof Error ? error.message : "Could not open this sprite.",
        });
      });

    return () => {
      disposed = true;
      // Flush on the way out so navigating away never loses the last stroke.
      void controller?.flushAndDispose();
    };
  }, [spriteId]);

  if (state.status === "loading") return fallback;
  if (state.status === "error") return renderError(state.message);

  return (
    <DocumentContext
      value={{
        doc: state.doc,
        history: state.history,
        autosave: state.autosave,
        saveStatus,
      }}
    >
      {children}
    </DocumentContext>
  );
}

export function useDocumentSession(): DocumentSession {
  const session = use(DocumentContext);
  if (!session) throw new Error("useDocumentSession must be used inside <DocumentProvider>");
  return session;
}
