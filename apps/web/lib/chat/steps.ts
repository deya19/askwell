import "server-only";
import { PLANS, type Plan } from "@askwell/shared";
import { embedQuery, toPgVector } from "../ai/embeddings";
import { CHAT_MODEL } from "../ai/models";
import { getOpenAI } from "../ai/openai";
import { createServiceClient } from "../supabase/service";
import type { GenerationStats } from "./analytics";
import { SYSTEM_PROMPT, buildChatInput } from "./prompt";

/** Chunks retrieved per question (§6.6 step 4). */
export const MATCH_COUNT = 5;

/** Caps the reply length, and the cost of one answer. */
export const MAX_REPLY_TOKENS = 500;

/** `ownerId` is the owner's Clerk user ID, for the owner-side chat events (§6.11). */
export type ChatProject = { id: string; ownerId: string; plan: Plan };

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
    .select("id, owner_id, accounts(plan)")
    .eq("public_key", key)
    .maybeSingle();

  if (error) throw new Error(`Could not load project: ${error.message}`);
  if (!data) return null;
  const plan = data.accounts.plan;
  if (!isPlan(plan)) throw new Error(`Unknown plan: ${plan}`);
  return { id: data.id, ownerId: data.owner_id, plan };
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

export type Answer = { reply: string; stats: GenerationStats };

/**
 * The bot's answer from the chunks (§6.6 step 5), with the model, tokens and latency for the
 * PostHog AI trace (§6.6 step 7). Throws on a model error or an empty reply.
 */
export async function answer(question: string, chunks: readonly string[]): Promise<Answer> {
  const started = performance.now();
  const response = await getOpenAI().responses.create({
    model: CHAT_MODEL,
    instructions: SYSTEM_PROMPT,
    input: buildChatInput(question, chunks),
    max_output_tokens: MAX_REPLY_TOKENS,
    store: false,
  });

  const latency = (performance.now() - started) / 1000;

  const reply = response.output_text.trim();
  if (!reply) throw new Error(`Empty reply from ${CHAT_MODEL} (status: ${response.status ?? "unknown"}).`);
  return {
    reply,
    stats: {
      model: response.model ?? CHAT_MODEL,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      latency,
      maxOutputTokens: MAX_REPLY_TOKENS,
    },
  };
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

/**
 * True if `conversationId` is the project's earliest conversation, i.e. its first saved chat
 * turn ever (for `first_chat`). Conversations are only deleted with their project, so exactly
 * one conversation per project is ever the earliest.
 */
export async function isFirstConversation(projectId: string, conversationId: string): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from("conversations")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load the first conversation: ${error.message}`);
  return data?.id === conversationId;
}
