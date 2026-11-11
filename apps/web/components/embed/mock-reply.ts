import { APP_NAME, type ChatRequest } from "@askwell/shared";

/**
 * Where the panel gets a bot reply. Phase 2 fakes it; Phase 3 replaces the body of
 * `requestReply` with `POST /api/widget/chat` and keeps the signature.
 */

export const MOCK_REPLY_DELAY_MS = 1000;
export const MOCK_REPLY = `Thanks for your message! This is a preview of ${APP_NAME}, so I can't answer yet. Real answers are coming soon.`;

/** What the panel needs back. `conversationId` arrives with the real route (Phase 3). */
export type PanelReply = { reply: string; conversationId?: string };

export type ReplyOptions = { delayMs?: number; signal?: AbortSignal };

/** The bot's reply to one visitor message. Rejects with the signal's reason if aborted. */
export function requestReply(_request: ChatRequest, { delayMs = MOCK_REPLY_DELAY_MS, signal }: ReplyOptions = {}): Promise<PanelReply> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => resolve({ reply: MOCK_REPLY }), delayMs);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
