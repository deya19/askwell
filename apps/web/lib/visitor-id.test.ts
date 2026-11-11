import { visitorIdSchema } from "@askwell/shared";
import { describe, expect, test, vi } from "vitest";
import { createVisitorId, getVisitorId, VISITOR_ID_STORAGE_KEY, type MemorySlot } from "./visitor-id";

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

const slot = (): MemorySlot => ({ id: null });

describe("createVisitorId", () => {
  test("matches visitorIdSchema and is random", () => {
    const ids = new Set(Array.from({ length: 50 }, () => createVisitorId()));
    expect(ids.size).toBe(50);
    for (const id of ids) {
      expect(visitorIdSchema.safeParse(id).success).toBe(true);
      expect(id).toMatch(/^v_[A-Za-z0-9_-]{22}$/);
    }
  });

  test("uses base64url, not + or /", () => {
    expect(createVisitorId(() => new Uint8Array(16).fill(0xff))).toBe("v_" + "_".repeat(21) + "w");
    expect(createVisitorId(() => new Uint8Array(16).fill(0xfb))).not.toMatch(/[+/=]/);
  });
});

describe("getVisitorId", () => {
  test("creates, stores and then reuses the ID", () => {
    const storage = memoryStorage();
    const first = getVisitorId(() => storage, slot());
    expect(storage.getItem(VISITOR_ID_STORAGE_KEY)).toBe(first);
    // A later visit (fresh page memory) reads the stored ID.
    expect(getVisitorId(() => storage, slot())).toBe(first);
  });

  test("keeps a valid stored ID", () => {
    const storage = memoryStorage({ [VISITOR_ID_STORAGE_KEY]: "v_existing123" });
    expect(getVisitorId(() => storage, slot())).toBe("v_existing123");
  });

  test.each(["", "short", "<script>", "x".repeat(129)])("replaces an invalid stored value %j", (bad) => {
    const storage = memoryStorage({ [VISITOR_ID_STORAGE_KEY]: bad });
    const id = getVisitorId(() => storage, slot(), () => "v_fresh12345");
    expect(id).toBe("v_fresh12345");
    expect(storage.getItem(VISITOR_ID_STORAGE_KEY)).toBe("v_fresh12345");
  });

  test("falls back to one in-memory ID when reading storage throws", () => {
    const blocked = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    const memory = slot();
    const create = vi.fn(() => "v_memory12345");
    expect(getVisitorId(blocked, memory, create)).toBe("v_memory12345");
    expect(getVisitorId(blocked, memory, create)).toBe("v_memory12345");
    expect(create).toHaveBeenCalledTimes(1);
  });

  test("falls back to memory when setItem throws, and keeps that ID", () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
    const memory = slot();
    const id = getVisitorId(() => storage, memory, () => "v_memory12345");
    expect(id).toBe("v_memory12345");
    expect(getVisitorId(() => storage, memory, () => "v_other123456")).toBe(id);
  });

  test("no storage (server render) uses memory", () => {
    const memory = slot();
    expect(getVisitorId(() => null, memory, () => "v_memory12345")).toBe("v_memory12345");
  });
});
