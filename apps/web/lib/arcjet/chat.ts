import "server-only";
import { CHAT_RATE_LIMIT_PER_MINUTE } from "@askwell/shared";
import { detectBot, detectPromptInjection, fixedWindow } from "@arcjet/next";
import { sendMessageBlocked, type AnalyticsProject } from "../chat/analytics";
import { getArcjet } from "./client";
import { failOpen, type ProtectResult } from "./decision";

type ChatArcjet = ReturnType<typeof createChatArcjet>;

function createChatArcjet() {
  return getArcjet()
    .withRule(detectBot({ mode: "LIVE", allow: [] }))
    .withRule(
      fixedWindow({
        mode: "LIVE",
        characteristics: ["publicKey", "ip.src"],
        window: 60,
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
 *
 * A block sends `message_blocked` (project.md §6.11) for the project's owner, with the reason
 * and no message text, after the response.
 */
export async function protectChat(
  request: Request,
  { key, message, project }: { key: string; message: string; project: AnalyticsProject },
): Promise<ProtectResult> {
  const result = await failOpen(() => {
    chatArcjet ??= createChatArcjet();
    return chatArcjet.protect(request, { publicKey: key, detectPromptInjectionMessage: message });
  });
  if (!result.allowed) sendMessageBlocked(project, result.reason);
  return result;
}
