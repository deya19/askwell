import "server-only";
import { PLANS, type Plan } from "@askwell/shared";
import { embedQuery, toPgVector } from "../ai/embeddings";
import { CHAT_MODEL } from "../ai/models";
import { getOpenAI } from "../ai/openai";
import { createServiceClient } from "../supabase/service";
import { SYSTEM_PROMPT, buildChatInput } from "./prompt";

/** Chunks retrieved per question (§6.6 step 4). */
export const MATCH_COUNT = 5;

/** Caps the reply length, and the cost of one answer. */
export const MAX_REPLY_TOKENS = 500;

export type ChatProject = { id: string; plan: Plan };

function isPlan(value: string): value is Plan {
  return (PLANS as readonly string[]).includes(value);
}

/**
 * The project for a public key, with the owner's plan, or null for an unknown key.
 * Public route: looks up by `public_key` only, with the service client (§9 Public key abuse).
 */
export async function getChatProject(key: string): Promise<ChatProject | null> {
  const { data, error } = await createServiceClient()
    .from("projects")
    .select("id, accounts(plan)")
    .eq("public_key", key)
    .maybeSingle();

  if (error) throw new Error(`Could not load project: ${error.message}`);
  if (!data) return null;
  const plan = data.accounts.plan;
  if (!isPlan(plan)) throw new Error(`Unknown plan: ${plan}`);
  return { id: data.id, plan };
}

/** True if `conversationId` is a conversation of `projectId`. */
export async function conversationBelongsTo(projectId: string, conversationId: string): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw new Error(`Could not load conversation: ${error.message}`);
  return data !== null;
}

/** Counts one message against the monthly quota. False at the limit (§6.6 step 3). */
export async function consumeMessage(projectId: string, maxMessages: number): Promise<boolean> {
  const { data, error } = await createServiceClient().rpc("consume_message", {
    project_id: projectId,
    max_messages: maxMessages,
  });
  if (error) throw new Error(`Could not count message: ${error.message}`);
  return data === true;
}

/** The top matching chunks of this project's ready sources (§6.6 step 4). */
export async function retrieveChunks(projectId: string, question: string): Promise<string[]> {
  const embedding = await embedQuery(question);
  const { data, error } = await createServiceClient().rpc("match_chunks", {
    project_id: projectId,
    query_embedding: toPgVector(embedding),
    match_count: MATCH_COUNT,
  });
  if (error) throw new Error(`Could not match chunks: ${error.message}`);
  return (data ?? []).map((row) => row.content);
}

/** The bot's answer from the chunks (§6.6 step 5). Throws on a model error or an empty reply. */
export async function answer(question: string, chunks: readonly string[]): Promise<string> {
  // TODO(Phase 4): PostHog AI trace (§6.6 step 7) around this call: model (CHAT_MODEL),
  // tokens (response.usage.input_tokens / output_tokens), cost, latency (time this call)
  // and the project id (pass it in from handleChat).
  const response = await getOpenAI().responses.create({
    model: CHAT_MODEL,
    instructions: SYSTEM_PROMPT,
    input: buildChatInput(question, chunks),
    max_output_tokens: MAX_REPLY_TOKENS,
    store: false,
  });

  const reply = response.output_text.trim();
  if (!reply) throw new Error(`Empty reply from ${CHAT_MODEL} (status: ${response.status ?? "unknown"}).`);
  return reply;
}

/** Saves the visitor message and the reply; creates the conversation on the first turn. Returns its id. */
export async function saveChatTurn(turn: {
  projectId: string;
  visitorId: string;
  conversationId?: string;
  message: string;
  reply: string;
}): Promise<string> {
  const { data, error } = await createServiceClient().rpc("save_chat_turn", {
    project_id: turn.projectId,
    visitor_id: turn.visitorId,
    visitor_message: turn.message,
    bot_reply: turn.reply,
    ...(turn.conversationId ? { conversation_id: turn.conversationId } : {}),
  });
  if (error) throw new Error(`Could not save chat turn: ${error.message}`);
  return data;
}
