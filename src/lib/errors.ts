/** The message to show a user for a caught value, which may not be an `Error` at all. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
