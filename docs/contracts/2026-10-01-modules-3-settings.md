# Modules 3/5: tools declare their settings; the host stores and renders them

Status: approved (2026-10-01)
Date: 2026-10-01
Depends on: [2 tool interfaces](2026-10-01-modules-2-tool-interfaces.md) merged
Series: [0 core](2026-10-01-modules-0-core-rename.md) · [1 tool folders](2026-10-01-modules-1-tool-folders.md) · [2 tool interfaces](2026-10-01-modules-2-tool-interfaces.md) · [3 settings](2026-10-01-modules-3-settings.md) · [4 painters](2026-10-01-modules-4-renderer-painters.md) · [5 host modules](2026-10-01-modules-5-host-modules.md)

## Context

Read "Why this series exists" in [stage 0](2026-10-01-modules-0-core-rename.md) first.

After stage 2, tools read options through a temporary `host.tool.options()`, which returns
today's `ToolOptions`. That type is the union of every tool's options, and the mirror option is
still spread over eight places:

- `ToolOptions` and `ToolOptionField`;
- the slice defaults and a mirror-only `withoutMirror` rule in `toolSlice`;
- a JSX branch in `ToolOptionsBar`;
- the brush-preview flags in `usePointerPaint`;
- `core/overlays/brushCursor.ts`;
- the `tool.toggleMirror` command;
- its id;
- its key.

Brush size is one global value shared by pencil and eraser.

## Goal

- A tool declares `settings: { size: brushSize(), mirrorHorizontal: toggle(…), … }` as data.
  It reads them with `host.tool.settings()` (typed from the declaration) and writes them with
  `host.tool.set(key, value)`.
- Values live in one generic slice keyed `settings[toolId][key]`, and absent means the
  declared default. The store knows no setting by name.
- `ToolOptionsBar` renders any tool's settings from their `kind`, with no per-option branch.
- A toggle or switch may declare a `command` (id, label, keys), which the host turns into a
  contributed command (stage 2's path). That is how `V` toggles mirror.
- "Press the tool's key again" steps a choice setting the tool names (`reselect: "size"`).
- Pencil and eraser own their brush preview through `src/tools/shared/brush.ts`, using
  `host.canvas`. `usePointerPaint` no longer knows about brushes, and the renderer's per-gesture
  overlay slot is deleted.

### Behaviour changes (settled by the maintainer)

1. **Brush size is per tool.** Pencil and eraser each remember their own size. Both default to 1.
2. **Mirror is remembered.** Switching away from the pencil and back keeps mirror on. No other tool can see it.
3. The options-bar label "Size" reads **"Brush size"**. It is the setting's label, so the bar,
   its aria-label and the cheat-sheet row "Cycle brush size" share one string.

## Non-goals

- No persistence across reloads.
- No settings for host modules. Grid and onion state stay host state (stage 5 gives them module stores).
- No new options, and no change to which tool has which settings.

## Decisions

| # | Decision | Why | Rejected alternative |
|---|----------|-----|----------------------|
| 1 | **Settled by the maintainer.** Settings are declared inside the owning tool, with no shared option state between tools | Simplest model: nothing shared, and nothing for lint to allow across folders | A shared option module |
| 2 | **Settled by the maintainer.** Values live in the host store, keyed by tool id. Absent means the default | The store stays generic, so a new tool never touches it | A store per tool folder |
| 3 | **Settled by the maintainer.** Per-tool brush size, and mirror is remembered | Follows from 1. `withoutMirror` existed only because the preview leaked mirror to the eraser | Shared size. Reset on switch |
| 4 | Setting kinds:<br>• `choice` (numbers, rendered as a toggle group)<br>• `toggle` (boolean, icon button, optional `group` label shown once before consecutive toggles in the group)<br>• `switch` (boolean, labelled switch) | Covers every current control with three small renderers. A tool can still ship its own JSX | A schema per option |
| 5 | A `toggle` or `switch` may declare `command: { id, label?, keys? }`. The host generates a `ContributedCommand`:<br>• `label` defaults to the setting label<br>• group `Tools`<br>• `isEnabled` = this tool active<br>• `isActive` = value<br>• `run` flips it<br>In the bar, such a toggle renders as a `CommandButton`, so its tooltip shows the key | One declaration gives value, control, command, key and tooltip. `tool.toggleMirror` keeps its id | A hand-written command per toggle |
| 6 | `Tool.reselect?: <choice key>`. The tool command's `hold.press` (tool already active, nothing held) steps that choice with `nextChoice`, wrapping. The cheat-sheet row reads `Cycle ${label.toLowerCase()}` · `<key> again` | Replaces `reselectCommand` and the global `tool.cycleBrushSize` | A per-tool cycle command id |
| 7 | `ToolControl` replaces `options()` with `settings(): SettingValues<S>` and `set(key, value)`. `ToolHost` becomes generic over the tool's settings type (`ToolHost<S>`) | Typed reads, still through the host interface (stage 2, Decision 1) | Passing values in the gesture |
| 8 | The brush preview moves into the tools. `src/tools/shared/brush.ts` exports `brushSize()` and `createBrushPreview(read)`, whose `activate(host)` and `move(point)` use `host.canvas`. `brushCursor.ts` moves to `src/tools/shared/` | `usePointerPaint` stops special-casing tools. Repaint on move replaces the continuous `animate` repaint | Keeping the preview in the pointer hook |
| 9 | Removed:<br>• `ToolOptions`, `ToolOptionField`, `Tool.options`, `reselectCommand` and `ToolControl.options`<br>• `toolSlice.toolOptions`, `setToolOptions`, `cycleBrushSize` and `withoutMirror`<br>• the `tool.cycleBrushSize` and `tool.toggleMirror` entries in `APP_COMMAND_IDS` and `APP_SHORTCUTS`<br>• `CanvasRenderer.setOverlayPainter`, `overlayPainter` and `overlayAnimating` | Replaced or dead | Compatibility shims |
| 10 | `SettingCommandId` is derived from `TOOL_LIST` like `ContributedCommandId`, and joins `CommandId` | Typo safety for `CommandButton command="tool.toggleMirror"` | `string` |
| 11 | `useToolSettings(tool)` (new, in `src/hooks/`, moving to `src/editor/toolbox/` in stage 5) returns `{ values, set(key, value) }` for React code | One door to setting values for UI | Each control selecting from the store |

## Data flow

```text
tool.ts  settings: { size: choice, mirrorHorizontal: toggle+command, … }   (declaration + defaults)
   ├─► ToolOptionsBar ─ useToolSettings(tool) ─► render by kind ─► set ──────┐
   ├─► contributed.ts ─ toggle.command ─► CommandDefinition (V) ─► set ──────┤
   ├─► toolCommands   ─ tool.reselect ─► "P again" ─► nextChoice ─► set ─────┤
   │                                                                        ▼
   │                                     editor store: settings[toolId][key]
   │                                                                        │
   └─► tool code ─ host.tool.settings() ◄── resolveSettings(declaration, stored) ◄┘
```

## Interfaces

```ts
// src/framework/settings.ts
export interface ChoiceSetting { kind: "choice"; label: string; values: readonly number[]; default: number }
export interface ToggleSetting { kind: "toggle"; label: string; icon: LucideIcon; default: boolean; group?: string; command?: SettingCommand }
export interface SwitchSetting { kind: "switch"; label: string; default: boolean; command?: SettingCommand }
export interface SettingCommand<Id extends string = string> { id: Id; label?: string; keys?: readonly KeyBinding[] }
export type Setting = ChoiceSetting | ToggleSetting | SwitchSetting;
export type Settings = Readonly<Record<string, Setting>>;
export type SettingValues<S extends Settings> = { readonly [K in keyof S]: S[K]["default"] };
export type StoredValues = Readonly<Record<string, number | boolean>>;

export function choice(spec: Omit<ChoiceSetting, "kind">): ChoiceSetting;
export function toggle(spec: Omit<ToggleSetting, "kind">): ToggleSetting;
export function switchSetting(spec: Omit<SwitchSetting, "kind">): SwitchSetting;
export function resolveSettings<S extends Settings>(settings: S | undefined, stored: StoredValues | undefined): SettingValues<S>;
/** The next value above `value`, wrapping to the first. */
export function nextChoice(setting: ChoiceSetting, value: number): number;

// src/framework/host.ts
export interface ToolControl<S extends Settings = Settings> {
  activate(): void;
  settings(): SettingValues<S>;
  set<K extends keyof S>(key: K, value: S[K]["default"]): void;
}
export interface ToolHost<S extends Settings = Settings> { /* colors, canvas, document, history */ readonly tool: ToolControl<S> }

// src/framework/tool.ts
readonly settings?: S;
readonly reselect?: { [K in keyof S]: S[K] extends ChoiceSetting ? K : never }[keyof S];

// src/stores/slices/settingsSlice.ts
export interface SettingsSlice {
  settings: Readonly<Record<string, StoredValues>>;
  setSetting: (toolId: string, key: string, value: number | boolean) => void;
}

// src/tools/shared/brush.ts
export const brushSize: () => ChoiceSetting;   // label "Brush size", BRUSH_SIZES, DEFAULT_BRUSH_SIZE
export interface BrushPreview { activate(host: ToolHost): () => void; move(point: Point | null): void }
export function createBrushPreview(read: (host: ToolHost) => { size: number; mirrorHorizontal?: boolean; mirrorVertical?: boolean }): BrushPreview;
```

Pencil after (sketch):

```ts
const preview = createBrushPreview((host) => host.tool.settings());
export const pencilTool = defineTool({
  id: "pencil", label: "Pencil", icon: Brush, group: "draw", shortcut: { key: "p" }, continuous: true,
  settings: {
    size: brushSize(),
    mirrorHorizontal: toggle({ label: "Mirror horizontally", icon: FlipHorizontal, group: "Mirror", default: false,
                               command: { id: "tool.toggleMirror", keys: [{ key: "v" }] } }),
    mirrorVertical: toggle({ label: "Mirror vertically", icon: FlipVertical, group: "Mirror", default: false }),
  },
  reselect: "size",
  onActivate: (host) => preview.activate(host),
  onHover: (_host, point) => { preview.move(point); return null; },
  onPointerDown(host, g) { g.surface.commit(stamp(g.surface, g.point, brush(host, g))); },
  onPointerMove(host, g) { preview.move(g.point); g.surface.commit(stampLine(g.surface, g.previous, g.point, brush(host, g))); },
});
```

## Files

- `src/framework/settings.ts`: new. `src/framework/host.ts`: `ToolControl<S>`. `src/framework/tool.ts`: settings and `reselect`, removals. Serves 4-7, 9.
- `src/stores/slices/settingsSlice.ts`: new, wired into `useEditorStore`. `src/stores/slices/toolSlice.ts`: removals, and `setTool` and the tap path just clear `heldTool`. Serves 2, 3, 9.
- `src/hooks/toolHost/createToolHost.ts`: `tool.settings`/`set` over the slice. `src/hooks/useToolSettings.ts`: new. Serves 7, 11.
- `src/components/editor/ToolOptionsBar.tsx`: a generic renderer by kind. Serves 4, 5.
- `src/commands/contributed.ts`: generates setting commands. `src/commands/toolCommands.ts`: the `reselect` press path, and removes the two old commands. `src/tools/index.ts` + `src/commands/types.ts`: `SettingCommandId`. Serves 5, 6, 10.
- `src/constants/commands.ts` and `src/constants/shortcuts.ts`: removals. `src/components/editor/ShortcutHelpDialog.tsx`: reselect and mirror rows from the new sources. Serves 6, 9.
- `src/tools/shared/brush.ts` and `brushCursor.ts` (moved). `src/tools/{pencil,eraser,picker}/tool.ts`: settings. Serves 1, 3, 8.
- `src/hooks/usePointerPaint.ts`: drops `showBrushPreview`. `src/core/renderer.ts`: drops the gesture overlay slot. Serves 8, 9.
- `docs/shortcuts.md` (per-tool `P`/`E` again, mirror remembered, implementation contract) and `docs/conventions.md` §1 ("a tool option → a setting in its `settings`").

## Test plan

Unit:

- New `tests/unit/framework/settings.test.ts`: `resolveSettings` defaults and overrides, and `nextChoice` 1→2→3→4→6→8→1.
- `tests/unit/tools/toolOptions.test.ts` becomes `settings.test.ts`:
  - pencil: `size`, `mirrorHorizontal`, `mirrorVertical`
  - eraser: `size`
  - picker: `pickFromComposite`
  - others: none
  - Only the pencil mirrors.
- `tests/unit/tools/tools.test.ts`: `fakeHost({ settings })` replaces the options fixtures.
- `tests/unit/stores/toolSlice.test.ts`: delete the mirror-reset, `setToolOptions` and `cycleBrushSize` tests. New `settingsSlice.test.ts`.
- `tests/unit/commands/toolCommands.test.ts`:
  - P again cycles only the pencil's size, and E again only the eraser's.
  - The generated `tool.toggleMirror` is enabled only on the pencil, and flips its value.

Browser:

- `ToolOptionsBar`: the "Brush size" label.
- `brush-preview`: green, plus "the eraser preview is never mirrored".
- New: "pencil 4 → eraser shows 1 → back to pencil shows 4", and "mirror survives pencil → eraser → pencil".
- Cheat-sheet rows unchanged.

Command: `npm run lint && npm run build && npm run test:coverage`

## Done when

- [ ] 1. `grep -rn "ToolOptions\|ToolOptionField\|toolOptions\|withoutMirror\|cycleBrushSize\|reselectCommand\|setOverlayPainter" src tests` is empty.
- [ ] 2. A setting is added by editing only its tool. Probe: add a `switchSetting` to the picker, see it in the bar, then revert.
- [ ] 3. Separate pencil and eraser sizes, and `P`/`E` again cycle their own.
- [ ] 4. `V` toggles pencil mirror (pressed state, `V` in the tooltip) and does nothing elsewhere. Mirror survives a tool switch.
- [ ] 5. The brush preview looks and follows the pointer as before.
- [ ] 6. The editor store has no field named after a tool or option.
- [ ] 7. The command above passes.

## Open risks

- `SettingValues<S>` must widen literal defaults (`1` becomes `number`). The helpers return wide types, so tools must use them.
- `ToolHost<S>` inside a heterogeneous `TOOL_LIST`: method-syntax handlers are bivariant, so this
  should fit. Check it under `strict`, and log any `satisfies` workaround.
- The preview no longer repaints every frame. It must still repaint on viewport change, which the
  renderer already does for the overlay channel.

## Open questions for the maintainer

None.

## Drift log
