# Phase 8 — Color & palettes

**Goal:** the colour workflow — primary/secondary swatches, a colour picker dialog, palette
management (create, edit, reorder, import/export), "colours used in this sprite", recent colours,
and number-key selection.

**Est.** 1 day · **Depends on:** phases 1 and 4

---

## 8.1 Colour utilities

Extend `src/lib/color.ts` (phase 0) with what the picker and palette tools need. Still pure, still
unit-tested.

```ts
export interface HSV { h: number; s: number; v: number }   // h 0–360, s/v 0–1

export function rgbToHsv({ r, g, b }: RGBA): HSV {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToRgb({ h, s, v }: HSV, alpha = 255): RGBA {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60  ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return {
    r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255), a: alpha,
  };
}

/** Parses '#rgb', '#rrggbb', '#rrggbbaa' — returns null instead of throwing on junk input. */
export function parseHex(value: string): RGBA | null {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim()) ? hexToRgba(value.trim()) : null;
}
```

## 8.2 Colours used in the sprite

Scanning cels is O(pixels) and runs on demand (opening the panel, after a stroke settles), never
per pixel.

`src/editor/colorUsage.ts`

```ts
import { packRgba } from '@/lib/color';
import type { SpriteDocument } from '@/editor/document';

export interface ColorUsage { hex: string; count: number }

/** Every distinct non-transparent colour in the document, most-used first. */
export function collectColorUsage(doc: SpriteDocument, limit = 256): ColorUsage[] {
  const counts = new Map<number, number>();

  for (const layer of doc.layers) {
    for (const frame of doc.frames) {
      const cel = doc.getCel(layer.id, frame.id);
      if (!cel) continue;
      const { pixels } = cel;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] === 0) continue;
        const key = packRgba({ r: pixels[i], g: pixels[i + 1], b: pixels[i + 2], a: pixels[i + 3] });
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ hex: unpackHex(key), count }));
}

function unpackHex(key: number): string {
  const channel = (shift: number) => ((key >>> shift) & 0xff).toString(16).padStart(2, '0');
  const alpha = key & 0xff;
  return `#${channel(24)}${channel(16)}${channel(8)}${alpha === 255 ? '' : channel(0)}`;
}
```

Run it in a `useDeferredValue`-style pattern so a 128×128×24-frame scan never blocks a stroke:

```ts
// src/hooks/useColorUsage.ts
export function useColorUsage(doc: SpriteDocument) {
  const [usage, setUsage] = useState<ColorUsage[]>([]);

  useEffect(() => {
    let timer: number;
    const schedule = () => {
      clearTimeout(timer);
      // Recompute 400 ms after the last pixel change, never during a stroke.
      timer = window.setTimeout(() => setUsage(collectColorUsage(doc)), 400);
    };
    schedule();
    return () => { clearTimeout(timer); };
  }, [doc]);

  return usage;
}
```

## 8.3 Palette repository usage & the palette hook

Phase 1 built `db/repositories/palettes.ts`. The React side is one hook backed by `useLiveQuery`,
so any palette edit anywhere updates every palette UI with no invalidation code:

`src/hooks/usePalettes.ts`

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { listPalettes } from '@/db/repositories/palettes';
import { useEditorStore } from '@/stores/useEditorStore';

export function usePalettes() {
  const palettes = useLiveQuery(() => listPalettes(), [], []);
  const activePaletteId = useEditorStore((state) => state.activePaletteId);
  const active = palettes.find((palette) => palette.id === activePaletteId) ?? palettes[0] ?? null;
  return { palettes, active };
}
```

## 8.4 Palette panel

`src/components/editor/PalettePanel.tsx`

```tsx
export function PalettePanel() {
  const { palettes, active } = usePalettes();
  const setActivePalette = useEditorStore((state) => state.setActivePalette);
  const setPrimaryColor = useEditorStore((state) => state.setPrimaryColor);
  const setSecondaryColor = useEditorStore((state) => state.setSecondaryColor);

  return (
    <section className="flex flex-col gap-2 border-b p-2" aria-label="Palette">
      <div className="flex items-center gap-1">
        <PaletteSelect palettes={palettes} value={active?.id ?? null} onChange={setActivePalette} />
        <PaletteMenu palette={active} />
      </div>

      <ColorSwatchGrid
        colors={active?.colors ?? []}
        onPick={setPrimaryColor}
        onPickSecondary={setSecondaryColor}
      />

      <ActiveColors />
      <RecentColors />
    </section>
  );
}
```

`src/components/common/ColorSwatch.tsx` — the shared primitive. Left click sets primary, right
click sets secondary, and the checkerboard shows through transparent swatches:

```tsx
import { cn } from '@/lib/utils';
import { luminance, parseHex, rgbaToHex, type RGBA } from '@/lib/color';

interface ColorSwatchProps {
  color: RGBA;
  isActive?: boolean;
  index?: number;              // renders the 1–9 hotkey hint
  onPick: (color: RGBA) => void;
  onPickSecondary?: (color: RGBA) => void;
}

export function ColorSwatch({ color, isActive, index, onPick, onPickSecondary }: ColorSwatchProps) {
  const hex = rgbaToHex(color, true);
  return (
    <button
      type="button"
      title={hex}
      aria-label={`Color ${hex}`}
      aria-pressed={isActive}
      className={cn(
        'relative size-5 rounded-sm border border-black/20 bg-[--checker-a] transition-transform',
        'hover:z-10 hover:scale-110 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring',
        isActive && 'ring-2 ring-ring',
      )}
      onClick={() => onPick(color)}
      onContextMenu={(event) => { event.preventDefault(); onPickSecondary?.(color); }}
    >
      <span className="absolute inset-0 rounded-sm" style={{ backgroundColor: rgbaToHex(color) , opacity: color.a / 255 }} />
      {index !== undefined && index < 9 && (
        <span className={cn(
          'absolute -bottom-px right-0.5 text-[8px] leading-none',
          luminance(color) > 0.5 ? 'text-black/60' : 'text-white/70',
        )}>
          {index + 1}
        </span>
      )}
    </button>
  );
}
```

`ActiveColors` shows the classic overlapping primary/secondary squares with a swap arrow (`X`) and
opens the colour picker dialog on click.

## 8.5 Colour picker dialog

Built on a canvas SV square plus a hue strip plus an alpha strip plus a hex field. Keep the
canvas interaction in a hook so the component is layout only:

`src/hooks/useColorField.ts`

```ts
/**
 * Turns pointer drags on a rectangle into normalised (x, y) in 0–1, with capture so the
 * drag continues outside the element. Shared by the SV square, hue strip and alpha strip.
 */
export function useColorField(onChange: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);

  const handle = (event: PointerEvent | React.PointerEvent) => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    onChange(
      clamp((event.clientX - rect.left) / rect.width, 0, 1),
      clamp((event.clientY - rect.top) / rect.height, 0, 1),
    );
  };

  const onPointerDown = (event: React.PointerEvent) => {
    ref.current?.setPointerCapture(event.pointerId);
    handle(event);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (event.buttons === 1) handle(event);
  };

  return { ref, onPointerDown, onPointerMove };
}
```

The dialog edits a local `HSV + alpha` state (so dragging hue through a grey colour doesn't lose
the hue), and commits `RGBA` on every change:

```tsx
export function ColorPickerDialog({ value, onChange, open, onOpenChange }: ColorPickerDialogProps) {
  const [hsv, setHsv] = useState(() => rgbToHsv(value));
  const [alpha, setAlpha] = useState(value.a);

  // Keep local HSV in sync when the colour changes from outside (eyedropper, palette click).
  useEffect(() => {
    const next = rgbToHsv(value);
    if (rgbaToHex(hsvToRgb(hsv, alpha), true) !== rgbaToHex(value, true)) { setHsv(next); setAlpha(value.a); }
  }, [value]);

  const commit = (nextHsv: HSV, nextAlpha: number) => {
    setHsv(nextHsv); setAlpha(nextAlpha);
    onChange(hsvToRgb(nextHsv, nextAlpha));
  };
  …
}
```

## 8.6 Palette editing

All palette mutations go through the repository; palettes are **not** part of the document's undo
history (they are app-level data, like settings). That is a deliberate split — an undo after
editing a palette should undo your last brush stroke, not your palette edit.

`src/components/editor/PaletteMenu.tsx` actions:

| Action | Implementation |
| --- | --- |
| New palette | `createPalette('New palette', [])` then select it |
| Duplicate | `createPalette(`${palette.name} copy`, palette.colors)` — the only way to "edit" a built-in |
| Rename | `updatePalette(id, { name })` |
| Add current colour | `updatePalette(id, { colors: [...colors, hex] })`, de-duplicated |
| Remove colour | context menu on the swatch |
| Reorder | drag-and-drop within `ColorSwatchGrid`, writes the reordered array |
| Add all sprite colours | `collectColorUsage(doc)` → merge into the palette |
| Export `.json` / `.gpl` | download (see below) |
| Import `.json` / `.gpl` / `.hex` | file input → parse → `createPalette` |

`src/lib/paletteFormats.ts` — GIMP `.gpl` is the lingua franca of pixel-art palettes and is
trivial to support both ways:

```ts
import { rgbaToHex, type RGBA } from '@/lib/color';
import type { Result } from '@/types/result';

export function parseGpl(text: string): Result<string[]> {
  const lines = text.split(/\r?\n/);
  if (!lines[0]?.startsWith('GIMP Palette')) return { ok: false, error: 'Not a GIMP palette file' };

  const colors: string[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim() || line.startsWith('#') || /^(Name|Columns):/i.test(line)) continue;
    const [r, g, b] = line.trim().split(/\s+/).map(Number);
    if ([r, g, b].some(Number.isNaN)) continue;
    colors.push(rgbaToHex({ r, g, b, a: 255 }));
  }
  return colors.length ? { ok: true, value: colors } : { ok: false, error: 'No colors found' };
}

export function toGpl(name: string, colors: RGBA[]): string {
  const header = `GIMP Palette\nName: ${name}\nColumns: 8\n#\n`;
  const body = colors
    .map((color) => `${pad(color.r)} ${pad(color.g)} ${pad(color.b)}\t${rgbaToHex(color)}`)
    .join('\n');
  return header + body + '\n';
}

const pad = (value: number) => String(value).padStart(3, ' ');
```

`parseHexList` (one hex per line, the Lospec `.hex` format) is four lines and worth having —
Lospec is where most users will get palettes.

## 8.7 Number-key colour selection

Wired properly in phase 11, but the store action belongs here:

```ts
// added to colorSlice
selectPaletteSlot: (index: number, target: 'primary' | 'secondary') => void;
```

implemented in the panel's container (it needs the palette, which lives in the DB) via a tiny
hook, `useColorHotkeys`, that reads `usePalettes()` and registers the commands.

---

## Done when

- [ ] Built-in palettes load on a fresh profile and can be duplicated but not deleted or edited.
- [ ] Creating, renaming, reordering and deleting a user palette persists across reload.
- [ ] Left/right-clicking a swatch sets the primary/secondary colour; `X` swaps them.
- [ ] Keys `1`–`9` pick the first nine slots of the active palette.
- [ ] The picker dialog round-trips: hex in → same hex out, alpha preserved exactly.
- [ ] Dragging hue through a fully desaturated colour does not reset the hue.
- [ ] "Colours used" lists every distinct colour in the sprite, most-used first, and refreshes
      after a stroke without stuttering the canvas.
- [ ] A `.gpl` exported from this app imports back with identical colours.
