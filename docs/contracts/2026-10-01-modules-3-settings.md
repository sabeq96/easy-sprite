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

- [x] 1. `grep -rnw "ToolOptions\|ToolOptionField\|toolOptions\|withoutMirror\|cycleBrushSize\|reselectCommand\|setOverlayPainter" src tests` is empty.
- [x] 2. A setting is added by editing only its tool. Probe: add a `switchSetting` to the picker, see it in the bar, then revert.
- [x] 3. Separate pencil and eraser sizes, and `P`/`E` again cycle their own.
- [x] 4. `V` toggles pencil mirror (pressed state, `V` in the tooltip) and does nothing elsewhere. Mirror survives a tool switch.
- [x] 5. The brush preview looks and follows the pointer as before.
- [x] 6. The editor store has no field named after a tool or option.
- [x] 7. The command above passes.

## Open risks

- `SettingValues<S>` must widen literal defaults (`1` becomes `number`). The helpers return wide types, so tools must use them.
- `ToolHost<S>` inside a heterogeneous `TOOL_LIST`: method-syntax handlers are bivariant, so this
  should fit. Check it under `strict`, and log any `satisfies` workaround.
- The preview no longer repaints every frame. It must still repaint on viewport change, which the
  renderer already does for the overlay channel.

## Open questions for the maintainer

None.

## Drift log

- **2026-10-01, the Done-when 1 grep matches `ToolOptionsBar`.** The pattern `ToolOptions` also
  matches the component this contract keeps by name (Files, Test plan), so the literal grep
  lists `EditorPage.tsx`, `ToolOptionsBar.tsx` and its browser test. With whole-word matching
  (`grep -rnw …`), or with `ToolOptionsBar` filtered out, it is empty. Ticked on that reading;
  renaming the component is left to the maintainer.
- **2026-10-01, `Tool.reselect` is a `string`; `defineTool` checks it (Open risk 2: hit).**
  `ToolHost<S>` in method-syntax handlers fits a heterogeneous `TOOL_LIST`, but
  `reselect?: ChoiceKey<S>` on the interface (a conditional type) made `S` invariant, so no tool
  with settings widened to `Tool<ToolId>`. The interface field is a plain `string`, and
  `defineTool`'s parameter is `Tool<Id, C, S> & { reselect?: ChoiceKey<S> }`, so a typo or a
  non-choice key is still a compile error at the definition (probed: `"flip"` and `"nope"` are
  rejected, `"size"` passes). No `satisfies` or extra cast was needed. `toolCommands` checks
  `kind === "choice"` at run time.
- **2026-10-01, `SettingCommandId`.** Derived from `TOOL_LIST` like `ContributedCommandId`
  (`T extends Tool<string, readonly ContributedCommand[], infer S extends Settings>`, then
  `SettingCommandIdOf<S>`, which reads `ToggleSetting<infer Id> | SwitchSetting<infer Id>`).
  `toggle` and `switchSetting` take a `const Id` generic that defaults to `never`, so a setting
  without a command adds nothing. `contributed.test.ts` pins it to `"tool.toggleMirror"` with
  `expectTypeOf`.
- **2026-10-01, `ChoiceSetting.unit?`.** It is not in the Interfaces sketch. The generic bar names
  each value `${value} ${unit}` (the bare number when there is no unit), so the brush size toggles
  keep their "3 pixels" accessible names. `brushSize()` sets `unit: "pixels"`.
- **2026-10-01, `BrushPreview<S>` is generic.** A tool's handlers get `ToolHost<S>`, so
  `createBrushPreview<S>(read: (host: ToolHost<S>) => BrushShape)` returns a preview whose
  `activate` takes that host. The tools annotate the reader:
  `createBrushPreview((host: PencilHost) => host.tool.settings())`. `brushCursorPainter` now
  takes one getter returning `{ point, size, mirrorHorizontal, mirrorVertical, sprite }` and
  draws `OverlayPaint` from `framework/host`, because `core/renderer` is off-limits in a tool
  folder.
- **2026-10-01, a setting change repaints the overlay (Open risk 3, extended).** `move()` only
  repaints when the pixel under the pointer changes, and the continuous repaint is gone. So
  `useCanvasRenderer` invalidates the overlay whenever the store's `settings` change. Without it,
  `P` again or `V` while hovering showed nothing until the pointer moved. A mutation check (effect
  disabled) failed two brush-preview browser tests; they pass with it. Viewport changes already
  repaint the overlay, as the risk said.
- **2026-10-01, the preview also moves on pointerdown.** The pencil and eraser call
  `preview.move(point)` in `onPointerDown` too (the sketch only did so in `onPointerMove`), so a
  pen or touch press with no prior hover shows the footprint.
- **2026-10-01, setting commands go through the contributed path.** `contributed.ts` turns each
  declared `command` into a `ContributedCommand`, and registers it in the same loop as
  `Tool.commands`, bound to `forTool(toolId)`. Its value and its flip go through
  `host.tool.settings()`/`set`. `ToolControl` has no "am I active" query, so `isEnabled` reads
  `useEditorStore.getState().toolId` (commands/ may import stores). `CONTRIBUTED_SHORTCUTS`
  carries their keys. The cheat sheet's mirror row still comes from `toolsGroupCommands` (a
  Tools command that is neither a tool key nor in `Tool.commands`), so the rows are unchanged
  (`core-editing` passes untouched).
- **2026-10-01, `reselectLabel(tool)`.** Exported from `toolCommands.ts` next to the press path.
  It returns `Cycle ${label.toLowerCase()}` or null, and the cheat sheet uses it.
- **2026-10-01, test placement and fixtures.**
  - The "generated `tool.toggleMirror` is enabled only on the pencil and flips its value" test
    lives in `contributed.test.ts`, where the command is generated, not in
    `toolCommands.test.ts`.
  - `fakeHost<S>({ settings })` returns `ToolHost<S>` (one `as unknown as` cast in the fixture)
    and starts from every registered tool's declared defaults. Where a test stores the host in a
    variable first, it annotates it with that tool's host type.
  - The picker unit tests that sample the active layer now pass `pickFromComposite: false`,
    because the real default (`true`) applies; the old fixture defaulted it to `false`. A new
    unit test covers "samples the merged image by default".
  - New `tests/unit/tools/brush.test.ts` covers `brushSize()` and `createBrushPreview`. New
    browser tests: "the preview follows the pointer, leaving nothing behind" and "a new brush
    size shows at once, without moving the pointer" (Done-when 5).
- **2026-10-01, browser tests whose assertions changed.**
  - `pencil.browser`: "mirroring is switched off when another tool is chosen, and stays off coming
    back" became "mirror survives pencil → eraser → pencil": `aria-pressed` is now `true`, and the
    click paints the mirrored pixel too (behaviour change 2).
  - `pencil.browser`: "the brush size is shared with the eraser and survives a tool switch" became
    "pencil size 4 → eraser shows 1 → back to pencil shows 4" (behaviour change 1).
  - `pencil.browser`: "a held P repeating cycles only once" reads `settings.pencil?.size` (still
    2). "V does nothing on a tool without mirroring…" asserts that `settings` stays `{}`, in place
    of `toolOptions.mirrorHorizontal === false`. Same meaning, and stricter.
  - `ToolOptionsBar.browser`: "picking another tool turns mirroring off…" became "mirror survives
    pencil → eraser → pencil, and the eraser never shows it" (behaviour change 2). The pencil test
    also asserts the "Brush size" and "Mirror" labels (behaviour change 3). The per-tool
    `test.each` reads the declared setting keys in place of `Tool.options`. The bar is rendered
    with `createContributedCommands` too, because the mirror button's command is now generated.
  - `brush-preview.browser`: "a tool that ignores mirroring never previews a mirrored footprint"
    became "the eraser preview is never mirrored". It can no longer force a shared stale flag, so
    it turns on the pencil's mirror and writes stray mirror keys under `eraser`. Its assertions
    are unchanged.
  - `eraser.browser`: "…never mirrors even if the flag is stale" became "…even with the pencil's
    on", with the same setup change and unchanged assertions.
  - `select.browser` and `tool-matrix.browser`: setup only (`setSetting("pencil", "size", n)`).
  - Unit tests: `toolSlice.test.ts` lost the mirror-reset, `setToolOptions` and `cycleBrushSize`
    tests, as planned. `toolOptions.test.ts` became `settings.test.ts`. `toolCommands.test.ts`
    asserts per-tool sizes. `contributed.test.ts` expects `tool.toggleMirror` among the
    registered ids.
- **2026-10-01, keyboard tool switch while hovering.** The host does not expose the pointer, so a
  tool switched by key shows its preview on the next pointer move. Before, the previous tool's
  brush painter (with its mirror flags captured at install) stayed on screen until the next move,
  even onto a tool with no brush, such as the bucket.
- **2026-10-01, not built: a tool's own JSX in the bar.** Decision 4's "why" column says a tool can
  still ship its own JSX. No tool needs it, so there is no slot for it yet.
- **2026-10-01, files outside the list.**
  - `src/hooks/useCanvasRenderer.ts`: the settings repaint.
  - `src/stores/slices/types.ts` and `tests/support/store.ts`: the new slice.
  - `src/tools/fill/tool.ts` and `src/tools/select/tool.ts`: `options: []` removed.
  - `tests/support/factories.ts`: `fakeHost`.
  - `docs/architecture.md`: the folder map, the overlay row of the canvas table, and the `tool`
    row and a settings paragraph under "Tool host".
- **2026-10-01, lint.** No new rule. `tools/shared/brush.ts` and `brushCursor.ts` import only
  `@/framework/*`, `@/constants/tools`, `@/core/pixels` and `@/core/viewport`, which the
  existing tool-folder override allows. `npm run lint` reports only the ten
  `only-export-components` warnings, all in files this stage does not touch.
