import { visitorIdSchema } from "@askwell/shared";

/**
 * The widget visitor's random ID (project.md §6.5). Kept in the iframe's localStorage, which
 * belongs to the app origin, so it's the same on every site that embeds the widget.
 * Not a secret and not proof of anything: it only groups one browser's chats.
 */

export const VISITOR_ID_STORAGE_KEY = "widget.visitorId";
const PREFIX = "v_";
const RANDOM_BYTES = 16;

/** Where the ID lives when storage is blocked: one ID for the life of the page. */
export type MemorySlot = { id: string | null };
const pageMemory: MemorySlot = { id: null };

/** `v_` + 22 base64url chars (128 random bits). Matches `visitorIdSchema`. */
export function createVisitorId(randomBytes: (n: number) => Uint8Array = defaultRandomBytes): string {
  const bytes = randomBytes(RANDOM_BYTES);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return PREFIX + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function defaultRandomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** Reading `window.localStorage` itself throws when third-party storage is blocked. */
function defaultStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

/**
 * The stored visitor ID, or a new one (saved for next time). If storage is missing or throws,
 * falls back to an ID in memory, reused for the rest of the page's life. Never throws.
 */
export function getVisitorId(
  getStorage: () => Storage | null = defaultStorage,
  memory: MemorySlot = pageMemory,
  create: () => string = createVisitorId,
): string {
  try {
    const storage = getStorage();
    if (storage) {
      const stored = storage.getItem(VISITOR_ID_STORAGE_KEY);
      if (visitorIdSchema.safeParse(stored).success) return stored as string;
      const id = memory.id ?? create();
      storage.setItem(VISITOR_ID_STORAGE_KEY, id);
      memory.id = id;
      return id;
    }
  } catch {
    // Blocked or full storage: use memory below.
  }
  memory.id ??= create();
  return memory.id;
}
