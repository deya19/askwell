import { describe, expect, test } from "vitest";
import {
  clearConversationId,
  conversationStorageKey,
  getConversationId,
  saveConversationId,
  type ConversationMemory,
} from "./conversation-id";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

const KEY_A = "pk_aaaaaaaaaaaaaaaa";
const KEY_B = "pk_bbbbbbbbbbbbbbbb";
const ID_1 = "6f1c2b0e-4b3a-4c1d-9e2f-0a1b2c3d4e5f";
const ID_2 = "7a2d3c1f-5c4b-4d2e-8f30-1b2c3d4e5f60";
const blocked = () => {
  throw new DOMException("The operation is insecure.", "SecurityError");
};
const mem = (): ConversationMemory => new Map();

describe("conversation ID", () => {
  test("none at first", () => {
    expect(getConversationId(KEY_A, () => memoryStorage(), mem())).toBeNull();
  });

  test("saved ID survives a reload (fresh page memory)", () => {
    const storage = memoryStorage();
    saveConversationId(KEY_A, ID_1, () => storage, mem());
    expect(storage.getItem(conversationStorageKey(KEY_A))).toBe(ID_1);
    expect(getConversationId(KEY_A, () => storage, mem())).toBe(ID_1);
  });

  test("kept per public key", () => {
    const storage = memoryStorage();
    const memory = mem();
    saveConversationId(KEY_A, ID_1, () => storage, memory);
    saveConversationId(KEY_B, ID_2, () => storage, memory);
    expect(getConversationId(KEY_A, () => storage, mem())).toBe(ID_1);
    expect(getConversationId(KEY_B, () => storage, mem())).toBe(ID_2);
  });

  test.each(["", "not-a-uuid", "<script>"])("ignores an invalid stored value %j", (bad) => {
    const storage = memoryStorage({ [conversationStorageKey(KEY_A)]: bad });
    expect(getConversationId(KEY_A, () => storage, mem())).toBeNull();
  });

  test("clear forgets it in storage and memory", () => {
    const storage = memoryStorage();
    const memory = mem();
    saveConversationId(KEY_A, ID_1, () => storage, memory);
    clearConversationId(KEY_A, () => storage, memory);
    expect(getConversationId(KEY_A, () => storage, memory)).toBeNull();
  });

  test("falls back to page memory when storage throws", () => {
    const memory = mem();
    expect(() => saveConversationId(KEY_A, ID_1, blocked, memory)).not.toThrow();
    expect(getConversationId(KEY_A, blocked, memory)).toBe(ID_1);
    clearConversationId(KEY_A, blocked, memory);
    expect(getConversationId(KEY_A, blocked, memory)).toBeNull();
  });

  test("falls back to page memory when setItem throws", () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
    const memory = mem();
    saveConversationId(KEY_A, ID_1, () => storage, memory);
    expect(getConversationId(KEY_A, () => storage, memory)).toBe(ID_1);
  });

  test("no storage (server render) uses memory", () => {
    const memory = mem();
    saveConversationId(KEY_A, ID_1, () => null, memory);
    expect(getConversationId(KEY_A, () => null, memory)).toBe(ID_1);
  });
});
