export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface HSV {
  /** 0–360 */
  h: number;
  /** 0–1 */
  s: number;
  /** 0–1 */
  v: number;
}

export const TRANSPARENT: RGBA = { r: 0, g: 0, b: 0, a: 0 };
export const BLACK: RGBA = { r: 0, g: 0, b: 0, a: 255 };

export function hexToRgba(hex: string): RGBA {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.replace(/./g, (char) => char + char) : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: full.length === 8 ? parseInt(full.slice(6, 8), 16) : 255,
  };
}

export function rgbaToHex({ r, g, b, a }: RGBA, includeAlpha = false): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}${includeAlpha ? channel(a) : ""}`;
}

export function rgbaToCss({ r, g, b, a }: RGBA): string {
  return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}

/** Packed 0xRRGGBBAA — a cheap key for colour-count maps and swatch identity. */
export function packRgba({ r, g, b, a }: RGBA): number {
  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}

export function unpackRgba(key: number): RGBA {
  return {
    r: (key >>> 24) & 0xff,
    g: (key >>> 16) & 0xff,
    b: (key >>> 8) & 0xff,
    a: key & 0xff,
  };
}

export function rgbaEquals(a: RGBA, b: RGBA): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

/** Returns null instead of throwing, so it can validate user input directly. */
export function parseHex(value: string): RGBA | null {
  const trimmed = value.trim();
  return /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed) ? hexToRgba(trimmed) : null;
}

export function rgbToHsv({ r, g, b }: RGBA): HSV {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  return { h: (hue + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToRgb({ h, s, v }: HSV, alpha = 255): RGBA {
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - chroma;

  const [r, g, b] =
    h < 60
      ? [chroma, x, 0]
      : h < 120
        ? [x, chroma, 0]
        : h < 180
          ? [0, chroma, x]
          : h < 240
            ? [0, x, chroma]
            : h < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a: alpha,
  };
}
