export const ROUTES = {
  home: "/",
  sprites: "/sprites",
  sprite: (id: string) => `/sprites/${id}`,
  spritesheet: (id: string) => `/spritesheets/${id}`,
  settings: "/settings",
} as const;
