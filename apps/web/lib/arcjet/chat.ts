import "server-only";
import { CHAT_RATE_LIMIT_PER_MINUTE } from "@askwell/shared";
import { detectBot, detectPromptInjection, slidingWindow } from "@arcjet/next";
import { getArcjet } from "./client";
import { failOpen, type ProtectResult } from "./decision";

type ChatArcjet = ReturnType<typeof createChatArcjet>;

function createChatArcjet() {
  return getArcjet()
    .withRule(detectBot({ mode: "LIVE", allow: [] }))
    .withRule(
      slidingWindow({
        mode: "LIVE",
        characteristics: ["publicKey", "ip.src"],
        interval: 60,
        max: CHAT_RATE_LIMIT_PER_MINUTE,
      }),
    )
    .withRule(detectPromptInjection({ mode: "LIVE" }));
}

let chatArcjet: ChatArcjet | undefined;

/**
 * Step 1 of `POST /api/widget/chat` (project.md §6.6): bots, rate limit of
 * `CHAT_RATE_LIMIT_PER_MINUTE` per public key + client IP, and prompt injection
 * in the message. Call once per message, before any AI call. Fails open.
 */
export async function protectChat(
  request: Request,
  { key, message }: { key: string; message: string },
): Promise<ProtectResult> {
  // TODO(Phase 4): send the PostHog `message_blocked` event (with `reason`) when this blocks.
  return failOpen(() => {
    chatArcjet ??= createChatArcjet();
    return chatArcjet.protect(request, { publicKey: key, detectPromptInjectionMessage: message });
  });
}
