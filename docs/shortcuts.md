# Keymap reference

Modelled on Piskel so muscle memory transfers, with the gaps filled in sensibly. Implemented in
[phase 11](phases/phase-11-shortcuts-polish.md). The tables below are a human-readable reference;
in code, each key lives next to what it triggers (see *Implementation contract*), and the in-app
cheat sheet (`?`) is generated from that.

## Tools

Tap a tool key to switch to that tool. Hold it (0.3 s or longer) to use the tool until you let
go, then you are back on the tool you had.

| Key | Command | Notes |
| --- | --- | --- |
| `P` | Pencil | press again (while the pencil is active) to cycle brush size 1→2→3→4→6→8→1 |
| `V` | Mirror horizontally | pencil only: toggles drawing on both sides of the vertical axis, like the options-bar button. Doesn't spring back when held |
| `E` | Eraser | press again (while the eraser is active) to cycle brush size, as with `P` |
| `B` | Paint bucket | contiguous fill |
| `G` | Fill similar | replaces matching colour across the whole layer |
| `O` | Color picker | samples the composite; hold `O` to pick a colour and go back to your tool |
| `S` | Select & move | click selects a pixel, drag selects a rectangle; drag inside the selection moves it, `Ctrl/⌘`+drag copies. The selection only exists while this tool is active, so releasing a held `S` drops it, and mid-drag cancels the move |
| `Esc` | Cancel / deselect | |

## Colors

| Key | Command |
| --- | --- |
| `X` | Swap primary and secondary |
| `D` | Reset to black/transparent |
| `1` … `9` | Select palette slot 1–9 as primary |
| `Shift`+`1` … `9` | Select palette slot 1–9 as secondary |

## Edit

| Key | Command |
| --- | --- |
| `Ctrl/⌘`+`Z` | Undo |
| `Ctrl/⌘`+`Shift`+`Z` / `Ctrl`+`Y` | Redo |
| `Ctrl/⌘`+`C` / `X` / `V` | Copy / cut / paste selection (paste switches to Select & move) |
| `Ctrl/⌘`+`A` | Select all (switches to Select & move) |
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

Where things live:

- **Tool keys and gestures live on the tool.** Each tool declares `shortcut` (the key that activates
  it), an optional `reselectCommand` (run when its key is pressed while it is already active, e.g.
  the pencil's brush-size cycle) and `hints` (its non-obvious gestures, e.g. `⌘ + Drag` to
  duplicate a selection) — see `src/tools/<tool>/tool.ts`.
- **Tap vs hold.** Tool commands carry a `hold` part (`CommandDefinition.hold`). `useShortcuts`
  calls its `press` instead of `run()`, then `release` on that key's keyup (`cancel` on window
  blur). The tap/hold decision (`TOOL_KEY_HOLD_MS`) lives in the tool slice.
- **Every other key** is in `APP_SHORTCUTS` in `src/constants/shortcuts.ts`.
- **`src/commands/keymap.ts`** merges both into `SHORTCUTS` and exposes `commandKeys(id)` — every
  chord for a command, formatted for display.
- **Inputs that are neither a tool's nor a command** (1–9, pan/zoom, right-drag for the secondary
  colour) are `HintSection`s exported next to the code that implements them. Each names the
  command group it belongs to, so the cheat sheet lists it there rather than in a section of its
  own.
- **A tool can claim commands** (`Tool.commands`): Select & move lists select all, deselect, copy,
  cut, paste and delete in its own section, and they are not repeated under Edit.
- **Hints are only for what you can't discover by clicking the obvious thing** — keys, modifiers,
  hidden zones, non-primary buttons. No "drag to draw" or "click to pick".

Rules that keep it honest:

1. **Every entry maps to a command id, not to a handler.** The key handler resolves the id in the
   command registry and calls `run()` (or `hold.press()` for a tool key). A shortcut for a command that does not exist is a type
   error.
2. **No chord is bound twice** — a unit test (`tests/unit/commands/keymap.test.ts`) walks the
   merged table.
3. **Every control that runs a command is a `CommandButton`**, which reads the label, all keys,
   enabled and active state from the registry — so a button cannot show a stale or missing
   shortcut. Popover triggers show their toggle command's keys via `commandKeys`.
4. **Typing is never intercepted.** The global handler bails when the event target is an
   `input`, `textarea`, `[contenteditable]`, or inside an open dialog — except for `Escape`.

`Ctrl` and `⌘` are normalised to a single `mod` modifier so one table serves both platforms;
the cheat sheet renders the right glyph per OS from `navigator.platform`.
