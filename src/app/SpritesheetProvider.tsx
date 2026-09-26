import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_TILE_SIZE } from "@/constants/canvas";
import { findSpritesheet } from "@/db/repositories/spritesheets";
import { History } from "@/editor/history";
import { SpritesheetDocument } from "@/editor/spritesheetDocument";
import { Autosave, type SaveStatus } from "@/services/autosave";
import { spritesheetSaveSource } from "@/services/spritesheetSaveSource";

export interface SpritesheetSession {
  doc: SpritesheetDocument;
  history: History;
  autosave: Autosave;
  saveStatus: SaveStatus;
}

const SpritesheetContext = createContext<SpritesheetSession | null>(null);

type LoadState =
  | { status: "loading"; spritesheetId: string }
  | { status: "missing"; spritesheetId: string }
  | {
      status: "ready";
      spritesheetId: string;
      doc: SpritesheetDocument;
      history: History;
      autosave: Autosave;
    };

export interface SpritesheetProviderProps {
  spritesheetId: string;
  children: ReactNode;
  fallback: ReactNode;
  notFound: ReactNode;
}

/**
 * Opens a spritesheet once, then owns it for the page's lifetime: the in-memory document, its
 * undo history, and the Autosave writing it back — the composer's DocumentProvider.
 */
export function SpritesheetProvider({
  spritesheetId,
  children,
  fallback,
  notFound,
}: SpritesheetProviderProps) {
  const [state, setState] = useState<LoadState>({ status: "loading", spritesheetId });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Navigating to a different sheet resets during render, so the stale one never shows a frame.
  if (state.spritesheetId !== spritesheetId) setState({ status: "loading", spritesheetId });

  useEffect(() => {
    let disposed = false;
    let autosave: Autosave | null = null;

    // A read that fails is treated like a missing sheet: there is nothing to edit either way.
    void findSpritesheet(spritesheetId)
      .catch(() => undefined)
      .then((record) => {
        if (disposed) return;
        if (!record) {
          setState({ status: "missing", spritesheetId });
          return;
        }
        const doc = new SpritesheetDocument({
          id: record.id,
          name: record.name,
          tileSize: record.tileSize ?? DEFAULT_TILE_SIZE,
          blocks: record.blocks,
        });
        autosave = new Autosave(spritesheetSaveSource(doc), setSaveStatus);
        const history = new History();
        // Dev-only handle, like __spriteEditor: how tests/browser/** flushes and reads the sheet.
        if (import.meta.env.DEV) {
          Object.assign(window, { __spritesheetEditor: { doc, history, autosave } });
        }
        setState({ status: "ready", spritesheetId, doc, history, autosave });
      });

    return () => {
      disposed = true;
      // Flush on the way out so navigating away never loses the last edit.
      void autosave?.flushAndDispose();
    };
  }, [spritesheetId]);

  if (state.status === "loading") return fallback;
  if (state.status === "missing") return notFound;

  return (
    <SpritesheetContext
      value={{ doc: state.doc, history: state.history, autosave: state.autosave, saveStatus }}
    >
      {children}
    </SpritesheetContext>
  );
}

export function useSpritesheetSession(): SpritesheetSession {
  const session = use(SpritesheetContext);
  if (!session) throw new Error("useSpritesheetSession must be used inside <SpritesheetProvider>");
  return session;
}
