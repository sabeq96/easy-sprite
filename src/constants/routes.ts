export const ROUTES = {
  home: "/",
  library: "/library",
  sprite: (id: string) => `/sprites/${id}`,
  spritesheet: (id: string) => `/spritesheets/${id}`,
  settings: "/settings",
} as const;
