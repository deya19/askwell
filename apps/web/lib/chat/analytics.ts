import "server-only";
import { after } from "next/server";
import type { BlockReason } from "../arcjet/decision";
import { captureAiEvent, captureServerEvent } from "../analytics/server";

/** The project fields chat analytics needs: events join the owner's person by Clerk user ID. */
export type AnalyticsProject = { id: string; ownerId: string };

/**
 * Runs `task` after the response is sent (`after()`), so PostHog never slows the reply.
 * Never throws, and logs a failed task: analytics must not fail the chat.
 */
export function inBackground(label: string, task: () => Promise<void>): void {
  const run = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[analytics] ${label} failed`, error);
    }
  };
  try {
    after(run);
  } catch (error) {
    console.error(`[analytics] Couldn't schedule ${label}`, error);
  }
}

/** `message_blocked` (project.md §6.11): Arcjet blocked a chat message. No message text. */
export function sendMessageBlocked(project: AnalyticsProject, reason: BlockReason): void {
  inBackground("message_blocked", () =>
    captureServerEvent({
      event: "message_blocked",
      distinctId: project.ownerId,
      properties: { project_id: project.id, reason },
    }),
  );
}

/**
 * `first_chat` (project.md §6.11): the project's first saved chat turn ever. `isFirst` checks
 * that the new conversation is the project's earliest one, so this sends once per project.
 */
export function sendFirstChatIfFirst(
  project: AnalyticsProject,
  conversationId: string,
  isFirst: (projectId: string, conversationId: string) => Promise<boolean>,
): void {
  inBackground("first_chat", async () => {
    if (!(await isFirst(project.id, conversationId))) return;
    await captureServerEvent({
      event: "first_chat",
      distinctId: project.ownerId,
      properties: { project_id: project.id, conversation_id: conversationId },
    });
  });
}

/** What one model call cost and took (§6.6 step 7). Never any message or reply text. */
export type GenerationStats = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Seconds. */
  latency: number;
  maxOutputTokens: number;
};

/**
 * The `$ai_generation` properties for one bot reply. The trace is the conversation, so every
 * turn of a conversation groups under it. Privacy: no `$ai_input` / `$ai_output_choices`, and
 * the visitor gets no person profile.
 */
export function generationProperties(
  stats: GenerationStats,
  { projectId, conversationId }: { projectId: string; conversationId: string },
): Record<string, unknown> {
  return {
    $ai_trace_id: conversationId,
    $ai_session_id: conversationId,
    $ai_span_name: "chat_reply",
    $ai_provider: "openai",
    $ai_model: stats.model,
    $ai_input_tokens: stats.inputTokens,
    $ai_output_tokens: stats.outputTokens,
    $ai_latency: stats.latency,
    $ai_stream: false,
    $ai_model_parameters: { max_output_tokens: stats.maxOutputTokens },
    $ai_http_status: 200,
    $ai_is_error: false,
    project_id: projectId,
    $process_person_profile: false,
  };
}

/**
 * Sends the bot reply's `$ai_generation` (§6.6 step 7) after the response. The visitor is the
 * distinct ID, without a person profile. PostHog works out the cost from the model and tokens.
 */
export function sendGeneration(
  stats: GenerationStats,
  turn: { projectId: string; conversationId: string; visitorId: string },
): void {
  inBackground("$ai_generation", () =>
    captureAiEvent({
      event: "$ai_generation",
      distinctId: turn.visitorId,
      properties: generationProperties(stats, turn),
    }),
  );
}
