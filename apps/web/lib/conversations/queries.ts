import "server-only";
import { messageRoleSchema, type ConversationResponse, type ListConversationsResponse } from "@askwell/shared";
import { createOwnerClient } from "../supabase/owner";
import { CONVERSATION_LIST_LIMIT, summarizeConversations, type MessageRowForSummary } from "./summary";

// Owner reads only. Both helpers use the owner client, so RLS (`owned_conversation_ids()`)
// scopes every row to the caller's projects (project.md §7, §9 Tenant leak).

/**
 * Rows per messages request. PostgREST caps a response at its `max_rows` (1000 by default),
 * so the messages are read in pages of that size until a short page comes back.
 */
export const MESSAGE_PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Every row of an ordered query, read `MESSAGE_PAGE_SIZE` rows at a time. Throws on an error. */
async function readAllPages<T>(fetchPage: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += MESSAGE_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + MESSAGE_PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load messages: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < MESSAGE_PAGE_SIZE) return rows;
  }
}

/**
 * The project's newest 100 conversations, newest first, each with its message count and
 * the start of its first visitor message. The caller checks the project is theirs first.
 * Throws on a database error.
 */
export async function listConversations(projectId: string): Promise<ListConversationsResponse> {
  const supabase = await createOwnerClient();
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, visitor_id, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CONVERSATION_LIST_LIMIT);
  if (error) throw new Error(`Could not load conversations: ${error.message}`);
  if (conversations.length === 0) return { conversations: [] };

  // Aggregates are off project-wide: read the messages and count them here.
  const ids = conversations.map((c) => c.id);
  const messages: MessageRowForSummary[] = await readAllPages((from, to) =>
    supabase
      .from("messages")
      .select("conversation_id, role, body, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );

  return { conversations: summarizeConversations(conversations, messages) };
}

/**
 * One conversation and its whole thread, oldest message first. Null when RLS hides it
 * (missing, or in someone else's project). `id` must be a UUID. Throws on a database error.
 */
export async function getConversation(id: string): Promise<ConversationResponse | null> {
  const supabase = await createOwnerClient();
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("id, project_id, visitor_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load conversation: ${error.message}`);
  if (!conversation) return null;

  const messages = await readAllPages((from, to) =>
    supabase
      .from("messages")
      .select("id, role, body, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );

  return {
    conversation: {
      id: conversation.id,
      projectId: conversation.project_id,
      visitorId: conversation.visitor_id,
      createdAt: conversation.created_at,
    },
    messages: messages.map((m) => ({
      id: m.id,
      // `role` is checked in the table; parsing keeps the type exact.
      role: messageRoleSchema.parse(m.role),
      body: m.body,
      createdAt: m.created_at,
    })),
  };
}
