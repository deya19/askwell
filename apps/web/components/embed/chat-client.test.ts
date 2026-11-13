import { describe, expect, test, vi } from "vitest";
import {
  CHAT_ENDPOINT,
  CHAT_FAILURE_TEXT,
  postChat,
  readChatResponse,
  sendChatMessage,
  type ChatResult,
  type ConversationStore,
} from "./chat-client";

const KEY = "pk_aaaaaaaaaaaaaaaa";
const VISITOR = "v_12345678";
const CONV_1 = "6f1c2b0e-4b3a-4c1d-9e2f-0a1b2c3d4e5f";
const CONV_2 = "7a2d3c1f-5c4b-4d2e-8f30-1b2c3d4e5f60";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const apiError = (status: number, code: string) => json(status, { error: { code, message: "server text" } });

describe("readChatResponse", () => {
  test("200 with a valid body → the reply and conversation", async () => {
    await expect(readChatResponse(json(200, { conversationId: CONV_1, reply: "Hi" }))).resolves.toEqual({
      ok: true,
      reply: "Hi",
      conversationId: CONV_1,
    });
  });

  test.each<[string, Response, ChatResult]>([
    ["429 rate_limited", apiError(429, "rate_limited"), { ok: false, failure: "rate_limited" }],
    ["429 quota_exceeded", apiError(429, "quota_exceeded"), { ok: false, failure: "quota_exceeded" }],
    ["403 forbidden", apiError(403, "forbidden"), { ok: false, failure: "forbidden" }],
    ["403 with another body", new Response("blocked", { status: 403 }), { ok: false, failure: "forbidden" }],
    ["404 not_found", apiError(404, "not_found"), { ok: false, failure: "not_found" }],
    ["400 invalid_request", apiError(400, "invalid_request"), { ok: false, failure: "failed" }],
    ["500 internal_error", apiError(500, "internal_error"), { ok: false, failure: "failed" }],
    ["429 with an unknown code", apiError(429, "something_else"), { ok: false, failure: "failed" }],
    ["200 with a bad body", json(200, { reply: 42 }), { ok: false, failure: "failed" }],
    ["200 that isn't JSON", new Response("<html>", { status: 200 }), { ok: false, failure: "failed" }],
  ])("%s", async (_name, response, expected) => {
    await expect(readChatResponse(response)).resolves.toEqual(expected);
  });
});

describe("CHAT_FAILURE_TEXT", () => {
  test("friendly text per failure, never the server's message", () => {
    expect(CHAT_FAILURE_TEXT).toEqual({
      rate_limited: "You're sending messages too fast. Try again in a minute.",
      quota_exceeded: "This chat has reached its monthly limit.",
      forbidden: "I can't help with that.",
      not_found: "Something went wrong. Try again.",
      failed: "Something went wrong. Try again.",
    });
  });
});

describe("postChat", () => {
  const request = { key: KEY, visitorId: VISITOR, message: "Hours?" };

  test("POSTs JSON to the same-origin route", async () => {
    const fetchImpl = vi.fn(async () => json(200, { conversationId: CONV_1, reply: "9 to 5" }));
    const signal = new AbortController().signal;

    await expect(postChat(request, { signal, fetchImpl })).resolves.toMatchObject({ ok: true, reply: "9 to 5" });
    expect(fetchImpl).toHaveBeenCalledWith(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  });

  test("a network error is a generic failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(postChat(request, { fetchImpl })).resolves.toEqual({ ok: false, failure: "failed" });
  });

  test("rethrows when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("Aborted", "AbortError");
    });
    await expect(postChat(request, { signal: controller.signal, fetchImpl })).rejects.toThrow("Aborted");
  });
});

function fakeStore(initial: string | null = null) {
  let current = initial;
  const store: ConversationStore = {
    get: vi.fn(() => current),
    save: vi.fn((_key: string, id: string) => {
      current = id;
    }),
    clear: vi.fn(() => {
      current = null;
    }),
  };
  return { store, current: () => current };
}

describe("sendChatMessage", () => {
  const input = { key: KEY, visitorId: VISITOR, message: "Hours?" };

  test("first message: no conversationId, then keeps the one in the reply", async () => {
    const { store, current } = fakeStore();
    const post = vi.fn(async (): Promise<ChatResult> => ({ ok: true, reply: "9 to 5", conversationId: CONV_1 }));

    await sendChatMessage(input, { post, store });

    expect(post).toHaveBeenCalledWith(input, { signal: undefined });
    expect(current()).toBe(CONV_1);
  });

  test("next message reuses the kept conversationId", async () => {
    const { store } = fakeStore(CONV_1);
    const post = vi.fn(async (): Promise<ChatResult> => ({ ok: true, reply: "Yes", conversationId: CONV_1 }));

    await sendChatMessage(input, { post, store });

    expect(post).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith({ ...input, conversationId: CONV_1 }, { signal: undefined });
  });

  test("a failure keeps the stored conversation", async () => {
    const { store, current } = fakeStore(CONV_1);
    const post = vi.fn(async (): Promise<ChatResult> => ({ ok: false, failure: "rate_limited" }));

    await expect(sendChatMessage(input, { post, store })).resolves.toEqual({ ok: false, failure: "rate_limited" });
    expect(post).toHaveBeenCalledOnce();
    expect(current()).toBe(CONV_1);
  });

  test("a stored conversation that's gone (404) is forgotten and the message retried once as new", async () => {
    const { store, current } = fakeStore(CONV_1);
    const post = vi
      .fn<(...args: Parameters<typeof postChat>) => Promise<ChatResult>>()
      .mockResolvedValueOnce({ ok: false, failure: "not_found" })
      .mockResolvedValueOnce({ ok: true, reply: "Hi", conversationId: CONV_2 });

    await expect(sendChatMessage(input, { post, store })).resolves.toMatchObject({ ok: true, conversationId: CONV_2 });
    expect(post).toHaveBeenNthCalledWith(2, input, { signal: undefined });
    expect(store.clear).toHaveBeenCalledWith(KEY);
    expect(current()).toBe(CONV_2);
  });

  test("404 without a stored conversation (unknown key) isn't retried", async () => {
    const { store } = fakeStore();
    const post = vi.fn(async (): Promise<ChatResult> => ({ ok: false, failure: "not_found" }));

    await expect(sendChatMessage(input, { post, store })).resolves.toEqual({ ok: false, failure: "not_found" });
    expect(post).toHaveBeenCalledOnce();
  });
});
