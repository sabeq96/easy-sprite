import type { CommandGroup } from "@/constants/commands";
import { formatModifier, type Modifier } from "@/lib/keys";

/** Only gestures worth teaching; a plain click needs no hint (see `Hint`). */
export type PointerAction = "drag" | "right-drag" | "middle-drag";

export type HintInput =
  | { hold: Modifier | "space" }
  | { pointer: PointerAction }
  /** For inputs no other form describes, like the range "1–9". */
  | { text: string };

/**
 * One thing the user can do, and how. Features declare these next to the code that implements
 * them; the shortcut sheet and tooltips only render them.
 *
 * Only declare what nobody finds by clicking the obvious thing: a key, a modifier, a hidden zone
 * or a non-primary button. "Click to pick a color" or "drag to draw" is noise, not a hint.
 */
export interface Hint {
  action: string;
  /** Pressed together; rendered joined with "+". */
  inputs: readonly HintInput[];
  /** Where the gesture applies, e.g. "inside selection". */
  where?: string;
}

/** Hints owned by a feature rather than a command, listed in the sheet under a command group. */
export interface HintSection {
  group: CommandGroup;
  hints: readonly Hint[];
}

const POINTER_LABELS: Record<PointerAction, string> = {
  drag: "Drag",
  "right-drag": "Right-drag",
  "middle-drag": "Middle-drag",
};

function formatInput(input: HintInput): string {
  if ("hold" in input) return input.hold === "space" ? "Space" : formatModifier(input.hold);
  if ("pointer" in input) return POINTER_LABELS[input.pointer];
  return input.text;
}

export function formatHint(hint: Hint): string {
  return hint.inputs.map(formatInput).join(" + ");
}

/** A label and the chords that do it — the one shape every shortcut list renders. */
export interface ShortcutRow {
  label: string;
  keys: string[];
}

export function hintRow(hint: Hint): ShortcutRow {
  return {
    label: hint.where ? `${hint.action} · ${hint.where}` : hint.action,
    keys: [formatHint(hint)],
  };
}
