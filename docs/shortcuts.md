# Keymap reference

Modelled on Piskel so muscle memory transfers, with the gaps filled in sensibly. Implemented in
[phase 11](phases/phase-11-shortcuts-polish.md); the table here is the source of truth and lives
in code as `src/constants/shortcuts.ts`.

## Tools

| Key | Command | Notes |
| --- | --- | --- |
| `P` | Pencil | press again to cycle brush size 1→2→3→4 |
| `V` | Mirror pencil | draws on both sides of the vertical axis |
| `E` | Eraser | |
| `B` | Paint bucket | contiguous fill |
| `G` | Fill similar | replaces matching colour across the whole layer |
| `O` | Color picker | samples the composite; `Alt` held = temporary picker from any tool |
| `S` | Rectangle select | |
| `M` | Move selection | `Alt`+drag copies instead of moving |
| `Esc` | Cancel / deselect | also drops a floating selection in place |

## Colors

| Key | Command |
| --- | --- |
| `X` | Swap primary and secondary |
| `D` | Reset to black/transparent |
| `1` … `9` | Select palette slot 1–9 as primary |
| `Shift`+`1` … `9` | Select palette slot 1–9 as secondary |
| `Alt`+click | Pick colour under cursor (any drawing tool) |

## Edit

| Key | Command |
| --- | --- |
| `Ctrl/⌘`+`Z` | Undo |
| `Ctrl/⌘`+`Shift`+`Z` / `Ctrl`+`Y` | Redo |
| `Ctrl/⌘`+`C` / `X` / `V` | Copy / cut / paste selection |
| `Ctrl/⌘`+`A` | Select all |
| `Delete` / `Backspace` | Clear selection contents |
| `Ctrl/⌘`+`S` | Force save (autosave already runs; this is for peace of mind) |

## Frames & layers

| Key | Command |
| --- | --- |
| `N` | New frame |
| `Shift`+`N` | Duplicate current frame |
| `,` / `.` | Previous / next frame |
| `Alt`+`,` / `Alt`+`.` | Move current frame left / right |
| `Enter` | Play / pause animation |
| `Ctrl/⌘`+`Shift`+`N` | New layer |
| `Page Up` / `Page Down` | Select layer above / below |
| `Ctrl/⌘`+`E` | Merge layer down |

## View

| Key | Command |
| --- | --- |
| `+` / `-` | Zoom in / out (ladder steps) |
| `0` | Fit to window |
| `Space`+drag, or middle-drag | Pan |
| `Ctrl/⌘`+`G` | Toggle pixel grid |
| `Ctrl/⌘`+`Shift`+`O` | Toggle onion skin |
| `Ctrl/⌘`+`K` | Command palette |
| `?` | Shortcut cheat sheet |

## Implementation contract

Three rules keep this table honest:

1. **Every entry maps to a command id, not to a handler.** `src/constants/shortcuts.ts` is a
   `Record<CommandId, KeyBinding[]>`; the key handler resolves the id in the command registry
   and calls `run()`. A shortcut for a command that does not exist is a type error.
2. **Bindings are checked for duplicates at module load** (dev only) so two features cannot
   silently claim the same chord.
3. **Typing is never intercepted.** The global handler bails when the event target is an
   `input`, `textarea`, `[contenteditable]`, or inside an open dialog — except for `Escape`.

`Ctrl` and `⌘` are normalised to a single `mod` modifier so one table serves both platforms;
the cheat sheet renders the right glyph per OS from `navigator.platform`.
