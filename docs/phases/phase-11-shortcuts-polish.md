# Phase 11 — Shortcuts, command palette & polish

**Goal:** one command registry behind every button, menu item and key chord; the full
[keymap](../shortcuts.md); a command palette; and the accessibility/performance pass that makes
the app feel finished.

**Est.** 1.5 days · **Depends on:** all previous phases

---

## 11.1 Why a command registry

Without one, "duplicate frame" exists three times: in the frames bar, in the context menu, and in
the key handler — and they drift. With one, a command is defined once with its label, icon,
enablement rule and handler, and every surface renders from that definition.

`src/constants/commands.ts` — ids only, so `src/constants/shortcuts.ts` can reference them
without importing any logic:

```ts
export const COMMAND_IDS = [
  // tools
  'tool.pencil', 'tool.mirrorPencil', 'tool.eraser', 'tool.bucket', 'tool.fillSimilar',
  'tool.picker', 'tool.select', 'tool.move', 'tool.cycleBrushSize',
  // edit
  'edit.undo', 'edit.redo', 'edit.copy', 'edit.cut', 'edit.paste', 'edit.selectAll',
  'edit.deselect', 'edit.deleteSelection', 'edit.save',
  // color
  'color.swap', 'color.reset',
  // layers
  'layer.add', 'layer.duplicate', 'layer.delete', 'layer.mergeDown', 'layer.selectAbove', 'layer.selectBelow',
  // frames
  'frame.add', 'frame.duplicate', 'frame.delete', 'frame.previous', 'frame.next',
  'frame.moveLeft', 'frame.moveRight', 'animation.togglePlay',
  // view
  'view.zoomIn', 'view.zoomOut', 'view.fit', 'view.toggleGrid', 'view.toggleOnion',
  // app
  'app.commandPalette', 'app.shortcutHelp', 'app.export', 'app.backToLibrary',
] as const;

export type CommandId = (typeof COMMAND_IDS)[number];
```

`src/commands/types.ts`

```ts
import type { CommandId } from '@/constants/commands';

export interface CommandDefinition {
  id: CommandId;
  /** Shown in the palette, tooltips and menus — one source of truth for wording. */
  label: string;
  group: 'Tools' | 'Edit' | 'Color' | 'Layers' | 'Frames' | 'View' | 'App';
  /** Lucide icon name resolved in the UI layer, not a component — keeps the map serialisable. */
  icon?: string;
  /** Computed at read time; the palette dims disabled commands rather than hiding them. */
  isEnabled?: () => boolean;
  isActive?: () => boolean;
  run: () => void;
}

export type CommandRegistry = Partial<Record<CommandId, CommandDefinition>>;
```

## 11.2 Building the registry

One hook assembles it from the session and store. It is the only place in the app that knows how
a user action maps onto a document mutation.

`src/commands/useEditorCommands.ts`

```ts
import { useDocumentSession } from '@/app/DocumentProvider';
import { useEditorStore } from '@/stores/useEditorStore';
import { useCommandDispatch } from '@/hooks/useCommandDispatch';
import { addFrameCommand, duplicateFrameCommand, moveFrameCommand, removeFrameCommand } from '@/editor/commands/frames';
import { addLayerCommand, mergeLayerDownCommand, removeLayerCommand } from '@/editor/commands/layers';
import { clearSelectionCommand, copySelection, pasteCommand } from '@/editor/commands/selection';
import { hasClipboard } from '@/editor/clipboard';
import type { CommandRegistry } from '@/commands/types';

export function useEditorCommands(): CommandRegistry {
  const { doc, history, autosave } = useDocumentSession();
  const dispatch = useCommandDispatch();
  const store = useEditorStore;            // read via getState() inside handlers, not as deps

  const target = () => {
    const { activeLayerId, activeFrameId } = store.getState();
    return activeLayerId && activeFrameId
      ? { doc, layerId: activeLayerId, frameId: activeFrameId }
      : null;
  };

  return {
    'edit.undo': {
      id: 'edit.undo', label: 'Undo', group: 'Edit', icon: 'Undo2',
      isEnabled: () => history.canUndo,
      run: () => history.undo(),
    },
    'edit.redo': {
      id: 'edit.redo', label: 'Redo', group: 'Edit', icon: 'Redo2',
      isEnabled: () => history.canRedo,
      run: () => history.redo(),
    },
    'edit.copy': {
      id: 'edit.copy', label: 'Copy', group: 'Edit',
      isEnabled: () => store.getState().selection !== null,
      run: () => {
        const context = target();
        const selection = store.getState().selection;
        if (context && selection) copySelection(context, selection);
      },
    },
    'edit.cut': {
      id: 'edit.cut', label: 'Cut', group: 'Edit',
      isEnabled: () => store.getState().selection !== null,
      run: () => {
        const context = target();
        const selection = store.getState().selection;
        if (!context || !selection) return;
        copySelection(context, selection);
        dispatch(() => clearSelectionCommand(context, selection, 'Cut'));
      },
    },
    'edit.paste': {
      id: 'edit.paste', label: 'Paste', group: 'Edit',
      isEnabled: hasClipboard,
      run: () => { const context = target(); if (context) dispatch(() => pasteCommand(context)); },
    },
    'frame.duplicate': {
      id: 'frame.duplicate', label: 'Duplicate frame', group: 'Frames', icon: 'CopyPlus',
      run: () => {
        const frameId = store.getState().activeFrameId;
        if (frameId) dispatch(() => duplicateFrameCommand(doc, frameId));
      },
    },
    'frame.next': {
      id: 'frame.next', label: 'Next frame', group: 'Frames',
      run: () => {
        const { activeFrameId, setActiveFrame } = store.getState();
        const index = doc.frameIndex(activeFrameId ?? '');
        setActiveFrame(doc.frames[(index + 1) % doc.frames.length].id);
      },
    },
    'view.toggleGrid': {
      id: 'view.toggleGrid', label: 'Toggle pixel grid', group: 'View', icon: 'Grid3x3',
      isActive: () => store.getState().gridEnabled,
      run: () => store.getState().toggleGrid(),
    },
    'edit.save': {
      id: 'edit.save', label: 'Save now', group: 'Edit', icon: 'Save',
      run: () => void autosave.flush(),
    },
    // …one entry per COMMAND_ID; grouped in separate files if this passes 200 lines:
    // commands/editCommands.ts, commands/frameCommands.ts, commands/viewCommands.ts,
    // each a function taking the same context object and returning a partial registry.
  };
}
```

> When this file approaches the 200-line limit, split it by group — each file exports
> `createFrameCommands(context): CommandRegistry` and the hook spreads them together. Do not let
> it grow into a 600-line switch.

## 11.3 Key binding matching

Pure and testable. Normalises `Ctrl`/`⌘` to a single `mod` so one table serves both platforms.

`src/lib/keys.ts`

```ts
export interface KeyBinding {
  /** `event.key` lowercased, or `event.code` for physical keys like 'space'. */
  key: string;
  mod?: boolean;      // Ctrl on Windows/Linux, ⌘ on macOS
  shift?: boolean;
  alt?: boolean;
}

export const IS_APPLE = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);

export function matchesBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
  const mod = IS_APPLE ? event.metaKey : event.ctrlKey;
  return (
    event.key.toLowerCase() === binding.key &&
    mod === Boolean(binding.mod) &&
    event.shiftKey === Boolean(binding.shift) &&
    event.altKey === Boolean(binding.alt)
  );
}

/** '⌘⇧Z' / 'Ctrl+Shift+Z' for tooltips and the cheat sheet. */
export function formatBinding(binding: KeyBinding): string {
  const parts: string[] = [];
  if (binding.mod) parts.push(IS_APPLE ? '⌘' : 'Ctrl');
  if (binding.shift) parts.push(IS_APPLE ? '⇧' : 'Shift');
  if (binding.alt) parts.push(IS_APPLE ? '⌥' : 'Alt');
  parts.push(binding.key.length === 1 ? binding.key.toUpperCase() : capitalise(binding.key));
  return parts.join(IS_APPLE ? '' : '+');
}

const capitalise = (value: string) => value[0].toUpperCase() + value.slice(1);
```

`src/constants/shortcuts.ts`

```ts
import type { CommandId } from '@/constants/commands';
import type { KeyBinding } from '@/lib/keys';

export const SHORTCUTS: Partial<Record<CommandId, KeyBinding[]>> = {
  'tool.pencil': [{ key: 'p' }],
  'tool.mirrorPencil': [{ key: 'v' }],
  'tool.eraser': [{ key: 'e' }],
  'tool.bucket': [{ key: 'b' }],
  'tool.fillSimilar': [{ key: 'g' }],
  'tool.picker': [{ key: 'o' }],
  'tool.select': [{ key: 's' }],
  'tool.move': [{ key: 'm' }],

  'edit.undo': [{ key: 'z', mod: true }],
  'edit.redo': [{ key: 'z', mod: true, shift: true }, { key: 'y', mod: true }],
  'edit.copy': [{ key: 'c', mod: true }],
  'edit.cut': [{ key: 'x', mod: true }],
  'edit.paste': [{ key: 'v', mod: true }],
  'edit.selectAll': [{ key: 'a', mod: true }],
  'edit.deselect': [{ key: 'escape' }],
  'edit.deleteSelection': [{ key: 'delete' }, { key: 'backspace' }],
  'edit.save': [{ key: 's', mod: true }],

  'color.swap': [{ key: 'x' }],
  'color.reset': [{ key: 'd' }],

  'frame.add': [{ key: 'n' }],
  'frame.duplicate': [{ key: 'n', shift: true }],
  'frame.previous': [{ key: ',' }],
  'frame.next': [{ key: '.' }],
  'frame.moveLeft': [{ key: ',', alt: true }],
  'frame.moveRight': [{ key: '.', alt: true }],
  'animation.togglePlay': [{ key: 'enter' }],

  'layer.add': [{ key: 'n', mod: true, shift: true }],
  'layer.mergeDown': [{ key: 'e', mod: true }],
  'layer.selectAbove': [{ key: 'pageup' }],
  'layer.selectBelow': [{ key: 'pagedown' }],

  'view.zoomIn': [{ key: '+' }, { key: '=' }],
  'view.zoomOut': [{ key: '-' }],
  'view.fit': [{ key: '0' }],
  'view.toggleGrid': [{ key: 'g', mod: true }],
  'view.toggleOnion': [{ key: 'o', mod: true, shift: true }],

  'app.commandPalette': [{ key: 'k', mod: true }],
  'app.shortcutHelp': [{ key: '?' }],
};

/** Dev-only guard: two features must never claim the same chord. */
if (import.meta.env.DEV) {
  const seen = new Map<string, CommandId>();
  for (const [commandId, bindings] of Object.entries(SHORTCUTS)) {
    for (const binding of bindings ?? []) {
      const signature = `${binding.mod ? 'mod+' : ''}${binding.shift ? 'shift+' : ''}${binding.alt ? 'alt+' : ''}${binding.key}`;
      const existing = seen.get(signature);
      if (existing) console.error(`Duplicate shortcut ${signature}: ${existing} and ${commandId}`);
      seen.set(signature, commandId as CommandId);
    }
  }
}
```

## 11.4 The global handler

`src/hooks/useShortcuts.ts`

```ts
import { useEffect } from 'react';
import { SHORTCUTS } from '@/constants/shortcuts';
import { matchesBinding } from '@/lib/keys';
import { useEditorStore } from '@/stores/useEditorStore';
import type { CommandId } from '@/constants/commands';
import type { CommandRegistry } from '@/commands/types';

/** Typing must never trigger a tool change. Escape is the one key that always gets through. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase())
  );
}

export function useShortcuts(commands: CommandRegistry) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat && !REPEATABLE.has(event.key)) return;
      if (isTypingTarget(event.target) && event.key !== 'Escape') return;

      // Hold Alt for a temporary eyedropper, exactly like Piskel.
      if (event.key === 'Alt') {
        useEditorStore.getState().pushTemporaryTool('picker');
        return;
      }

      for (const [commandId, bindings] of Object.entries(SHORTCUTS)) {
        if (!bindings?.some((binding) => matchesBinding(event, binding))) continue;

        const command = commands[commandId as CommandId];
        if (!command || command.isEnabled?.() === false) return;

        event.preventDefault();      // only after a real match, so the browser keeps the rest
        command.run();
        return;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt') useEditorStore.getState().popTemporaryTool();
    };

    // Release held modifiers when the window loses focus, or the tool sticks.
    const onBlur = () => useEditorStore.getState().popTemporaryTool();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [commands]);
}

const REPEATABLE = new Set(['+', '=', '-', ',', '.', 'ArrowLeft', 'ArrowRight']);
```

Number keys `1`–`9` need the palette, so they live in their own hook next to the palette panel
(`useColorHotkeys`) rather than in the global table — a shortcut that depends on async data does
not belong in a static map.

## 11.5 Command palette

shadcn's `command` component over the same registry — zero extra wiring per command:

```bash
npx shadcn@latest add command
```

```tsx
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const commands = useEditorCommands();
  const groups = Object.values(commands).reduce<Record<string, CommandDefinition[]>>((acc, command) => {
    (acc[command.group] ??= []).push(command);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search commands…" />
      <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>
        {Object.entries(groups).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((command) => (
              <CommandItem
                key={command.id}
                disabled={command.isEnabled?.() === false}
                onSelect={() => { command.run(); onOpenChange(false); }}
              >
                {command.label}
                <CommandShortcut>{formatShortcutFor(command.id)}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
```

And the cheat sheet (`?`) renders the same `SHORTCUTS` table grouped by `command.group` — so the
docs, the palette and the help dialog can never disagree.

## 11.6 Polish pass

### Status bar

`src/components/editor/EditorStatusBar.tsx` — the small things that make an editor feel precise:

| Slot | Content |
| --- | --- |
| Left | cursor position `x, y` (or `–` outside the canvas), colour under cursor |
| Centre | sprite size, frame `3 / 12`, active layer name |
| Right | zoom `800%`, save status (`Saved` / `Saving…` / `Unsaved changes`), memory |

Cursor position updates on every pointer move, so it must not re-render the editor. Subscribe to
a dedicated tiny store (`useCursorStore`) that only the status bar reads.

### Accessibility

- Every icon-only button has `aria-label`; toggles carry `aria-pressed`; the active tool is
  `aria-pressed="true"` rather than colour-only.
- The canvas container gets `role="application"` and `aria-label="Sprite canvas"`, and is
  focusable so keyboard users can reach the shortcuts.
- Focus rings come from the shadcn `focus-visible` styles — never `outline: none`.
- Respect `prefers-reduced-motion`: disable marching-ants animation and panel transitions.
- Contrast: the palette swatches sit on a checkerboard, so they carry a `border-black/20` ring to
  stay visible against both light and dark tiles.

### Error handling

- A route-level `<ErrorBoundary>` around the editor with a "Back to library" escape hatch. A
  crash must never strand the user on a blank canvas.
- `QuotaError` from any repository shows a toast that explains the fix (export a backup, delete
  sprites) rather than a stack trace.
- Opening a sprite id that no longer exists redirects to `/sprites` with a toast.

### Performance checklist

Run these with React DevTools' "Highlight updates" and the Performance panel:

| Check | Target |
| --- | --- |
| Drawing a stroke | zero React re-renders; only canvas repaints |
| Stroke latency at 128×128, 4 layers | < 8 ms per pointer batch |
| Switching frames on a 24-frame sprite | < 16 ms |
| Palette panel open with 256 colours | no dropped frames while drawing |
| Gallery with 200 sprites | stable memory across scrolls (object URLs revoked) |
| Autosave of a 64×64×24 sprite | off the main thread long enough to be invisible |

If stroke latency misses the target, the first thing to check is that `compositeFrame` is not
being called from a React render — it belongs only in the renderer and in thumbnail effects.

### Final review gate

- [ ] `npm run lint` clean, including the `src/editor/**` boundary rule.
- [ ] `npm run build` clean (`tsc -b` with no `any` and no unused locals).
- [ ] `npm run test` green, including the round-trip backup test.
- [ ] No file over 200 lines; no component over 150; spot-check with
      `find src -name '*.tsx' -o -name '*.ts' | xargs wc -l | sort -rn | head -20`.
- [ ] Every entry in [shortcuts.md](../shortcuts.md) works and appears in the cheat sheet.

---

## Done when

- [ ] Every toolbar button, menu item and key chord resolves through the command registry.
- [ ] Typing in any input never triggers a tool change or an undo.
- [ ] Holding Alt switches to the eyedropper and releasing restores the previous tool — including
      when the window loses focus mid-hold.
- [ ] `Ctrl/⌘+K` opens the palette; disabled commands appear dimmed, not missing.
- [ ] `?` opens a cheat sheet that matches the keymap exactly, with correct ⌘/Ctrl glyphs.
- [ ] The app survives: reload mid-stroke, deleting the open sprite in another tab, a full quota,
      and a corrupt backup import — each with a clear message and no data loss.
