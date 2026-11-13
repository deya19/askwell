import { apiErrorSchema, chatResponseSchema, type ChatRequest } from "@askwell/shared";
import { clearConversationId, getConversationId, saveConversationId } from "../../lib/conversation-id";

/**
 * How the panel talks to `POST /api/widget/chat` (project.md §6.5 On send / Errors, §6.6).
 * Same origin: the panel is served by the app, inside the widget iframe.
 */

export const CHAT_ENDPOINT = "/api/widget/chat";

/** What went wrong, as the panel shows it. */
export type ChatFailure = "rate_limited" | "quota_exceeded" | "forbidden" | "not_found" | "failed";

export type ChatResult = { ok: true; reply: string; conversationId: string } | { ok: false; failure: ChatFailure };

/** The friendly text for each failure (§6.5 Errors). Never the server's message. */
export const CHAT_FAILURE_TEXT: Record<ChatFailure, string> = {
  rate_limited: "You're sending messages too fast. Try again in a minute.",
  quota_exceeded: "This chat has reached its monthly limit.",
  forbidden: "I can't help with that.",
  not_found: "Something went wrong. Try again.",
  failed: "Something went wrong. Try again.",
};

/** Maps a chat route response to a result. Anything unexpected is `failed`. */
export async function readChatResponse(response: Response): Promise<ChatResult> {
  if (response.status === 403) return { ok: false, failure: "forbidden" };
  if (response.status === 404) return { ok: false, failure: "not_found" };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, failure: "failed" };
  }

  if (response.ok) {
    const parsed = chatResponseSchema.safeParse(body);
    return parsed.success
      ? { ok: true, reply: parsed.data.reply, conversationId: parsed.data.conversationId }
      : { ok: false, failure: "failed" };
  }

  const error = apiErrorSchema.safeParse(body);
  const code = error.success ? error.data.error.code : undefined;
  if (response.status === 429 && (code === "rate_limited" || code === "quota_exceeded")) return { ok: false, failure: code };
  return { ok: false, failure: "failed" };
}

/** One POST to the chat route. Rethrows only when aborted; a network error is `failed`. */
export async function postChat(
  request: ChatRequest,
  { signal, fetchImpl = fetch }: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<ChatResult> {
  let response: Response;
  try {
    response = await fetchImpl(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    return { ok: false, failure: "failed" };
  }
  return readChatResponse(response);
}

export type ConversationStore = {
  get: (key: string) => string | null;
  save: (key: string, conversationId: string) => void;
  clear: (key: string) => void;
};

const browserStore: ConversationStore = {
  get: (key) => getConversationId(key),
  save: (key, id) => saveConversationId(key, id),
  clear: (key) => clearConversationId(key),
};

export type SendDeps = { post?: typeof postChat; store?: ConversationStore; signal?: AbortSignal };

/**
 * Sends one visitor message in the visitor's current conversation and remembers the
 * conversation the reply belongs to. If the stored conversation is gone (404), forgets it
 * and retries once as a new conversation: a 404 counts nothing (§6.6 step 2).
 */
export async function sendChatMessage(
  { key, visitorId, message }: { key: string; visitorId: string; message: string },
  { post = postChat, store = browserStore, signal }: SendDeps = {},
): Promise<ChatResult> {
  const conversationId = store.get(key);
  let result = await post({ key, visitorId, message, ...(conversationId ? { conversationId } : {}) }, { signal });

  if (!result.ok && result.failure === "not_found" && conversationId) {
    store.clear(key);
    result = await post({ key, visitorId, message }, { signal });
  }

  if (result.ok) store.save(key, result.conversationId);
  return result;
}
