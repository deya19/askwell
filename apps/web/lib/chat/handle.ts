import "server-only";
import { PLAN_LIMITS, type ApiErrorCode, type ChatRequest, type ChatResponse } from "@askwell/shared";
import { protectChat } from "../arcjet/chat";
import {
  answer,
  consumeMessage,
  conversationBelongsTo,
  getChatProject,
  retrieveChunks,
  saveChatTurn,
} from "./steps";

export type ChatOutcome =
  | { ok: true; body: ChatResponse }
  | { ok: false; code: ApiErrorCode; message: string; cause?: unknown };

const fail = (code: ApiErrorCode, message: string, cause?: unknown): ChatOutcome => ({ ok: false, code, message, cause });

/**
 * One visitor message, in the order of project.md §6.6. Every exit before "count" counts
 * nothing and calls no AI. After counting, a failure still uses the message (no refund).
 * Errors before counting are thrown to the route (plain 500).
 */
export async function handleChat(request: Request, input: ChatRequest): Promise<ChatOutcome> {
  const project = await getChatProject(input.key);
  if (!project) return fail("not_found", "No widget for this key.");

  const protection = await protectChat(request, { key: input.key, message: input.message });
  if (!protection.allowed) {
    switch (protection.reason) {
      case "rate_limit":
        return fail("rate_limited", "Too many messages. Wait a minute and try again.");
      case "prompt_injection":
        return fail("forbidden", "This message can't be answered. Try asking another way.");
      case "bot":
      case "shield":
        return fail("forbidden", "Request blocked.");
    }
  }

  if (input.conversationId && !(await conversationBelongsTo(project.id, input.conversationId))) {
    return fail("not_found", "Conversation not found.");
  }

  const counted = await consumeMessage(project.id, PLAN_LIMITS[project.plan].messagesPerMonth);
  if (!counted) return fail("quota_exceeded", "This chat has reached its message limit for the month.");

  // Counted from here on: a failure keeps the message counted (§6.6 step 3, no refund).
  let reply: string;
  try {
    const chunks = await retrieveChunks(project.id, input.message);
    reply = await answer(input.message, chunks);
  } catch (cause) {
    return fail("internal_error", "The assistant couldn't answer right now. Please try again.", cause);
  }

  const conversationId = await saveChatTurn({
    projectId: project.id,
    visitorId: input.visitorId,
    conversationId: input.conversationId,
    message: input.message,
    reply,
  });
  return { ok: true, body: { conversationId, reply } };
}
