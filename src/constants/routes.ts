export const ROUTES = {
  home: "/",
  sprites: "/sprites",
  sprite: (id: string) => `/sprites/${id}`,
  settings: "/settings",
} as const;
