export interface BuiltInPalette {
  id: string;
  name: string;
  colors: string[];
}

export const RECENT_COLORS_MAX = 16;

/** Built-ins own the reserved `builtin-` id prefix and are re-seeded on every boot. */
export const BUILT_IN_PALETTES: BuiltInPalette[] = [
  {
    id: "builtin-dawnbringer-16",
    name: "DawnBringer 16",
    colors: [
      "#140c1c", "#442434", "#30346d", "#4e4a4e", "#854c30", "#346524", "#d04648", "#757161",
      "#597dce", "#d27d2c", "#8595a1", "#6daa2c", "#d2aa99", "#6dc2ca", "#dad45e", "#deeed6",
    ],
  },
  {
    id: "builtin-pico-8",
    name: "PICO-8",
    colors: [
      "#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
      "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa",
    ],
  },
  {
    id: "builtin-endesga-16",
    name: "Endesga 16",
    colors: [
      "#e4a672", "#b86f50", "#743f39", "#3f2832", "#9e2835", "#e53b44", "#fb922b", "#ffe762",
      "#63c64d", "#327345", "#193d3f", "#4f6781", "#afbfd2", "#ffffff", "#2ce8f4", "#0484d1",
    ],
  },
  {
    id: "builtin-grayscale-8",
    name: "Grayscale 8",
    colors: ["#000000", "#242424", "#484848", "#6d6d6d", "#919191", "#b6b6b6", "#dadada", "#ffffff"],
  },
];
