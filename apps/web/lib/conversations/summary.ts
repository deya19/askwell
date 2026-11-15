import type { ConversationSummary } from "@askwell/shared";

/** How much of the first visitor message the list shows (project.md §6.7). */
export const PREVIEW_LENGTH = 120;

/** The newest conversations the list returns. No paging (product owner's decision). */
export const CONVERSATION_LIST_LIMIT = 100;

export type ConversationRowForSummary = { id: string; visitor_id: string; created_at: string };
export type MessageRowForSummary = { conversation_id: string; role: string; body: string; created_at: string };

/** The start of a message on one line: whitespace collapsed, cut to `PREVIEW_LENGTH` characters. */
export function toPreview(body: string): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  // Code points, so a cut never splits an emoji in half.
  return Array.from(oneLine).slice(0, PREVIEW_LENGTH).join("");
}

/**
 * Builds the list rows: each conversation's message count and the preview of its first
 * visitor message ("" when it has none). Keeps the conversations' order.
 * `messages` must be oldest first.
 */
export function summarizeConversations(
  conversations: readonly ConversationRowForSummary[],
  messages: readonly MessageRowForSummary[],
): ConversationSummary[] {
  const counts = new Map<string, number>();
  const previews = new Map<string, string>();
  for (const message of messages) {
    counts.set(message.conversation_id, (counts.get(message.conversation_id) ?? 0) + 1);
    if (message.role === "visitor" && !previews.has(message.conversation_id)) {
      previews.set(message.conversation_id, toPreview(message.body));
    }
  }

  return conversations.map((conversation) => ({
    id: conversation.id,
    visitorId: conversation.visitor_id,
    preview: previews.get(conversation.id) ?? "",
    messageCount: counts.get(conversation.id) ?? 0,
    createdAt: conversation.created_at,
  }));
}
