export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
    this.name = "NotFoundError";
  }
}

export class QuotaError extends Error {
  constructor() {
    super("Storage is full. Export a backup and delete some sprites.");
    this.name = "QuotaError";
  }
}

/** Wraps a write so a browser quota failure becomes an error the UI can explain. */
export async function withQuotaGuard<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new QuotaError();
    }
    // Dexie wraps the DOMException, so check the name on plain errors too.
    if (error instanceof Error && error.name === "QuotaExceededError") throw new QuotaError();
    throw error;
  }
}
