import type { ConversationSummary, MessageRole } from "@askwell/shared";
import { formatCreatedDate } from "../projects/copy";
import { CONVERSATION_LIST_LIMIT } from "../../lib/conversations/summary";

/** The Conversations page for a project. */
export function conversationsPath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/conversations`;
}

/** One conversation's thread. */
export function conversationPath(projectId: string, conversationId: string): string {
  return `${conversationsPath(projectId)}/${encodeURIComponent(conversationId)}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "Just now", "5 min ago", "3 h ago", then the date ("Nov 11, 2026") from a day on.
 * `now` is passed in, so the server renders it once and tests stay fixed.
 */
export function timeLabel(createdAt: string, now: number): string {
  const age = now - new Date(createdAt).getTime();
  if (age < MINUTE) return "Just now";
  if (age < HOUR) return `${Math.floor(age / MINUTE)} min ago`;
  if (age < DAY) return `${Math.floor(age / HOUR)} h ago`;
  return formatCreatedDate(createdAt);
}

const fullTimeFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

/** "Nov 11, 2026, 3:04 PM UTC". Fixed locale and UTC, like the other dashboard dates. */
export function fullTimeLabel(createdAt: string): string {
  return `${fullTimeFormat.format(new Date(createdAt))} UTC`;
}

/** "1 message", "12 messages". */
export function messageCountLabel(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "message" : "messages"}`;
}

export const LIST_LIMIT_NOTE = `Showing the newest ${CONVERSATION_LIST_LIMIT} conversations.`;

/** The note under the list, only when the list is cut at the limit. */
export function listLimitNote(count: number): string | null {
  return count >= CONVERSATION_LIST_LIMIT ? LIST_LIMIT_NOTE : null;
}

export const EMPTY_PREVIEW = "No visitor message";

export const ROLE_LABELS: Record<MessageRole, string> = { visitor: "Visitor", bot: "Bot" };

/** A list row, with its text ready to render. Bodies stay plain strings: React renders them as text. */
export type ConversationRowData = {
  id: string;
  href: string;
  /** "" when the conversation has no visitor message. */
  preview: string;
  count: string;
  time: string;
  fullTime: string;
  createdAt: string;
};

export function toConversationRows(
  projectId: string,
  conversations: readonly ConversationSummary[],
  now: number = Date.now(),
): ConversationRowData[] {
  return conversations.map((c) => ({
    id: c.id,
    href: conversationPath(projectId, c.id),
    preview: c.preview,
    count: messageCountLabel(c.messageCount),
    time: timeLabel(c.createdAt, now),
    fullTime: fullTimeLabel(c.createdAt),
    createdAt: c.createdAt,
  }));
}
