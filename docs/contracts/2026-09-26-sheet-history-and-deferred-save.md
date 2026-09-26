# Spritesheet: deferred save, undo/redo, tile size

Status: done
Date: 2026-09-26

## Goal
The spritesheet editor works like the sprite editor:
- Edits live in an in-memory document and are saved on a debounce (the same `AUTOSAVE_DEBOUNCE_MS`).
- ⌘S / "Save now" writes immediately.
- Adding, moving and removing sprites, and changing the tile size, can be undone and redone.
- The tile size can be changed after creation from a ☰ menu.

## Non-goals
- No database sync or remote storage. Only the save cadence is prepared for it.
- The sprite editor's save behaviour does not change. Its logic only moves into a save source.
- Renaming a sheet is not undoable, matching the sprite editor. It is still deferred-saved.
- No fixed sheet size, no packing constraints, no changes to export layout.
- The library page keeps its live queries. Sheet cards update when a save lands, not per edit.
- Sprites deleted in another tab while a sheet is open are not reconciled live (see Open risks).

## Decisions
| # | Decision | Why | Rejected alternative |
|---|----------|-----|----------------------|
| 1 | A new `SpritesheetDocument` (framework-free, in `src/editor/`) holds `name`, `tileSize`, `blocks`, with change events and revision counters | Deferred saves make the database stale, so the page needs an in-memory source of truth, as the sprite editor has | Keeping the live query plus optimistic guesses: any other write re-runs the query and reverts blocks to the stale database for up to 2s |
| 2 | **One `Autosave` class** (debounce, flush, one write in flight, status, flush on tab hide, flush-and-dispose) over a `SaveSource` adapter per editor: `spriteSaveSource` (dirty cels, structure, throttled thumbnail, moved unchanged from `AutosaveController`) and `spritesheetSaveSource` | One class for both editors: one place to change cadence when database sync arrives, and the providers look the same | Shared timing core plus two controller classes; a copied sheet controller |
| 3 | A `SpritesheetProvider` opens the sheet once (`getSpritesheet`), owns doc + `History` + autosave, and flushes on unmount. It mirrors `DocumentProvider`. `useSpritesheet` (live query) is deleted | Same lifecycle as the sprite editor, and navigating away never loses the last edit | Loading from the live query and ignoring later reads (fragile) |
| 4 | Reuse `History`/`Command` from `editor/history.ts`. The sheet commands are `setBlocksCommand(doc, next, label)` and `setTileSizeCommand(doc, tile)`, holding before/after snapshots (blocks are tiny) | Same undo stack, byte limits and labels as the sprite editor | A separate sheet history class |
| 5 | Undo labels: "Add sprite", "Move sprite", "Remove sprite", "Change tile size" | The top-bar buttons read "Undo move sprite", as the sprite editor's do | One generic "Edit sheet" label |
| 6 | Each flush writes one `updateSpritesheet({ name, tileSize, blocks })`, then the sheet thumbnail | Same database shape as today, now one write per flush instead of one per edit | Per-field writes |
| 7 | `useBuilderDnd` reads blocks from the document snapshot and commits through `history.push(setBlocksCommand(...))`. `useOptimisticOrder` is no longer used there (the palette panel still uses it) | The document updates synchronously, so the drop lands with no optimistic layer | Keeping the optimistic layer on top of the document |
| 8 | Sheet commands gain `edit.undo`, `edit.redo` and `edit.save` (⌘Z, ⇧⌘Z/⌘Y, ⌘S from the shared keymap). The top bar gets Undo/Redo buttons, and a ☰ "Spritesheet menu" with "Tile size…" and "Save now" | Mirrors the sprite editor's `EditorTopBar`/`EditorMenu` | Grid popover (your call) |
| 9 | The "Tile size…" dialog reuses `TileSizePicker` and applies through `setTileSizeCommand`. The grid resets through the existing effect | Consistent with Resize canvas | — |
| 10 | Dev handle `window.__spritesheetEditor = { doc, history, autosave }` for browser tests, like `__spriteEditor` | Tests can flush and read state without waiting 2s | Shortening the debounce under test |
| 11 | `useSaveStatus` is deleted (its only user is the builder) | Replaced by the autosave status | — |

## Interfaces
```ts
// services/autosave.ts: the only autosave (AutosaveController renamed)
export interface SaveSource {
  subscribe(onChange: () => void): () => void;   // returns the unsubscribe
  write(): Promise<void | "clean">;              // "clean" = nothing to write
  /** Called when a write fails, so the next flush retries it. */
  restore?(): void;
}
export class Autosave {
  constructor(source: SaveSource, onStatus: (s: SaveStatus) => void);
  schedule(): void; flush(): Promise<void>; dispose(): void; flushAndDispose(): Promise<void>;
}
// services/spriteSaveSource.ts:       spriteSaveSource(doc: SpriteDocument): SaveSource
// services/spritesheetSaveSource.ts:  spritesheetSaveSource(doc: SpritesheetDocument): SaveSource

// editor/spritesheetDocument.ts
export class SpritesheetDocument {
  readonly id: string; name: string; tileSize: number; blocks: SpritesheetBlockRecord[];
  readonly events: Emitter<{ blocks: void; meta: void }>;
  readonly revisions: { blocks: number; meta: number };
  setBlocks(next: SpritesheetBlockRecord[]): void;
  setMeta(patch: { name?: string; tileSize?: number }): void;
}
// editor/commands/spritesheet.ts
setBlocksCommand(doc, next, label): Command | null     // null when the layout is unchanged
setTileSizeCommand(doc, tile): Command | null

// app/SpritesheetProvider.tsx
<SpritesheetProvider spritesheetId fallback notFound>{children}</SpritesheetProvider>
useSpritesheetSession(): { doc, history, autosave, saveStatus }
// hooks/useSpritesheetSnapshot.ts — { revision, id, name, tileSize, blocks } (fresh arrays)

// hooks/useBuilderDnd.ts
useBuilderDnd(doc: SpritesheetDocument, history: History, sizes: BlockSizes)  // `track` param gone
// commands/useBuilderCommands.ts — adds edit.undo / edit.redo / edit.save
// components/builder/SpritesheetMenu.tsx, TileSizeDialog.tsx (new)
```
`SpritesheetBlockRecord` stays the block type; `DocumentInit`-style loading goes through `getSpritesheet`.

## Test approach
- Unit:
  - `Autosave` with fake timers and a stub source: debounce restarts, flush cancels the timer, concurrent flush shares one write, error sets status and the next schedule retries.
  - `SpritesheetDocument` plus both commands: undo/redo, null on no-op.
  - The existing `documentService` and autosave behaviour for sprites still pass.
- Browser (update existing sheet suites to flush through the dev handle before reading the database), plus:
  - A drag isn't in the database before the flush, and is after ⌘S.
  - Undo/redo of add, move and remove, via keys and buttons.
  - Tile size dialog, then undo, restores it, and the grid follows.
  - Navigating back flushes.
  - The save badge goes pending → saved.
- Commands: `npm run lint && npx tsc -b && npm test && npm run test:browser`

## Done when
- [ ] A sheet edit leaves the database unchanged until the debounce fires or ⌘S / "Save now" runs. Then name, tile size, blocks and thumbnail are written in one flush.
- [ ] Leaving the page, or hiding the tab, flushes pending edits.
- [ ] ⌘Z / ⇧⌘Z / ⌘Y and the top-bar Undo/Redo buttons undo and redo add, move, remove and tile-size changes, with labelled tooltips.
- [ ] ☰ menu → "Tile size…" changes the tile (undoable, grid follows). "Save now" saves immediately and toasts "Saved".
- [ ] The sheet's shortcut list shows Undo, Redo and Save now.
- [ ] The sprite editor's autosave tests and behaviour are unchanged. Both editors use the same `Autosave` class, each through its own `SaveSource`.
- [ ] `useSpritesheet` and `useSaveStatus` are deleted.
- [ ] The test command passes.

## Open risks
- A sprite deleted from the library while its sheet is open in another tab: the open sheet still holds the block, and the next flush writes it back. It renders as "Missing sprite" and can be removed. Accepted for now.
- Two tabs editing the same sheet: last flush wins (today it's last write wins, per edit).

## Tasks
- [ ] `src/services/autosave.ts` (generic `Autosave`), `src/services/spriteSaveSource.ts` (new), `src/app/DocumentProvider.tsx` → 1, 2, 6
- [ ] `src/editor/spritesheetDocument.ts`, `src/editor/commands/spritesheet.ts` (new) → 1, 3
- [ ] `src/services/spritesheetSaveSource.ts` (new) → 1, 2
- [ ] `src/app/SpritesheetProvider.tsx` (new); delete `src/hooks/useSpritesheet.ts` and `src/hooks/useSaveStatus.ts` → 2, 7
- [ ] `src/hooks/useSpritesheetSnapshot.ts` (new), `src/hooks/useBuilderDnd.ts` → 1, 3
- [ ] `src/commands/useBuilderCommands.ts` → 3, 4, 5
- [ ] `src/components/builder/SpritesheetMenu.tsx`, `TileSizeDialog.tsx` (new), `SpritesheetBuilderPage.tsx` (provider, undo/redo buttons, menu, name through doc) → 3, 4
- [ ] `tests/unit/services/autosave.test.ts`, `tests/unit/editor/spritesheetDocument.test.ts` (new); sheet browser suites plus the new cases above; `tests/support/builder.ts` flush helper → 8

## Drift log
- `SaveSource.restore?()` dropped: each source puts its own dirty flag back inside the write when the write fails, which keeps the retry logic next to the state it restores.
- `SaveSource.write()` returns `"clean" | Promise<void>` and decides synchronously, so `Autosave` never shows "saving" for a no-op flush, which keeps the sprite editor's status behaviour unchanged (review finding).
- The provider loads with `findSpritesheet` and renders `notFound` for a missing record (or a failed read), rather than `getSpritesheet` throwing.
- The sheet's save source keeps its own cache of opened sprites for the thumbnail. The page's `useDocumentCache` lives in React, below the provider that creates the source.
- `Autosave.dispose()` also clears a pending timer.

