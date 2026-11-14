import { idSchema } from "@askwell/shared";

/**
 * The visitor's current conversation per widget key (project.md §6.5, §6.6). Kept in the
 * iframe's localStorage (the app origin), so a reload of the host page continues the same
 * conversation. Not a secret: the chat route checks it belongs to the key's project.
 */

const STORAGE_PREFIX = "widget.conversationId.";

export function conversationStorageKey(publicKey: string): string {
  return STORAGE_PREFIX + publicKey;
}

/** Where IDs live when storage is blocked: per key, for the life of the page. */
export type ConversationMemory = Map<string, string>;
const pageMemory: ConversationMemory = new Map();

type GetStorage = () => Storage | null;

/** Reading `window.localStorage` itself throws when third-party storage is blocked. */
function defaultStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

/** The stored conversation ID for this key, or null. Ignores invalid values. Never throws. */
export function getConversationId(
  publicKey: string,
  getStorage: GetStorage = defaultStorage,
  memory: ConversationMemory = pageMemory,
): string | null {
  try {
    const stored = getStorage()?.getItem(conversationStorageKey(publicKey)) ?? null;
    if (idSchema.safeParse(stored).success) return stored;
  } catch {
    // Blocked storage: use memory below.
  }
  return memory.get(publicKey) ?? null;
}

/** Remembers the conversation for this key: in storage if it works, always in memory. Never throws. */
export function saveConversationId(
  publicKey: string,
  conversationId: string,
  getStorage: GetStorage = defaultStorage,
  memory: ConversationMemory = pageMemory,
): void {
  memory.set(publicKey, conversationId);
  try {
    getStorage()?.setItem(conversationStorageKey(publicKey), conversationId);
  } catch {
    // Blocked or full storage: memory keeps it for this page.
  }
}

/** Forgets the conversation for this key, so the next message starts a new one. Never throws. */
export function clearConversationId(
  publicKey: string,
  getStorage: GetStorage = defaultStorage,
  memory: ConversationMemory = pageMemory,
): void {
  memory.delete(publicKey);
  try {
    getStorage()?.removeItem(conversationStorageKey(publicKey));
  } catch {
    // Nothing stored to clear.
  }
}
