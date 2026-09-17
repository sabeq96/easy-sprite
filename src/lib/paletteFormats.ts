import { parseHex, rgbaToHex, type RGBA } from "@/lib/color";
import { err, ok, type Result } from "@/types/result";

/**
 * GIMP `.gpl` is the lingua franca of pixel-art palettes, and Lospec `.hex` is where most
 * users will get theirs. Both parsers return a Result: the input is a user-supplied file.
 */
export function parseGpl(text: string): Result<string[]> {
  const lines = text.split(/\r?\n/);
  if (!lines[0]?.startsWith("GIMP Palette")) return err("That is not a GIMP palette file.");

  const colors: string[] = [];
  for (const line of lines.slice(1)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || /^(Name|Columns):/i.test(trimmed)) continue;

    const [r, g, b] = trimmed.split(/\s+/).map(Number);
    if ([r, g, b].some((channel) => Number.isNaN(channel))) continue;
    colors.push(rgbaToHex({ r, g, b, a: 255 }));
  }

  return colors.length ? ok(colors) : err("No colors found in that palette file.");
}

export function toGpl(name: string, colors: RGBA[]): string {
  const pad = (value: number) => String(value).padStart(3, " ");
  const header = `GIMP Palette\nName: ${name}\nColumns: 8\n#\n`;
  const body = colors
    .map((color) => `${pad(color.r)} ${pad(color.g)} ${pad(color.b)}\t${rgbaToHex(color)}`)
    .join("\n");

  return `${header + body}\n`;
}

/** One hex colour per line, with or without a leading `#`. */
export function parseHexList(text: string): Result<string[]> {
  const colors: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";")) continue;

    const parsed = parseHex(trimmed.startsWith("#") ? trimmed : `#${trimmed}`);
    if (parsed) colors.push(rgbaToHex(parsed, parsed.a !== 255));
  }

  return colors.length ? ok(colors) : err("No valid hex colors found.");
}

export function toHexList(colors: string[]): string {
  return `${colors.map((hex) => hex.replace("#", "")).join("\n")}\n`;
}

/** Picks the parser from the file extension, falling back to sniffing the contents. */
export function parsePaletteFile(filename: string, text: string): Result<string[]> {
  if (filename.toLowerCase().endsWith(".gpl")) return parseGpl(text);
  if (filename.toLowerCase().endsWith(".hex")) return parseHexList(text);
  return text.startsWith("GIMP Palette") ? parseGpl(text) : parseHexList(text);
}
