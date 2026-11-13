import "server-only";
import type { ArcjetDecision } from "@arcjet/next";

/** Why Arcjet blocked a request. */
export type BlockReason = "rate_limit" | "prompt_injection" | "bot" | "shield";

export type ProtectResult = { allowed: true } | { allowed: false; reason: BlockReason };

const ALLOWED: ProtectResult = { allowed: true };

/**
 * Turns an Arcjet decision into allowed / blocked.
 *
 * Fails open, as Arcjet recommends: if Arcjet errors (timeout, outage, bad
 * config) the request goes through and the error is logged. The monthly
 * message quota still caps cost while Arcjet is down.
 */
export function toProtectResult(decision: ArcjetDecision): ProtectResult {
  if (decision.isDenied()) {
    const { reason } = decision;
    if (reason.isRateLimit()) return { allowed: false, reason: "rate_limit" };
    if (reason.isPromptInjection()) return { allowed: false, reason: "prompt_injection" };
    if (reason.isBot()) return { allowed: false, reason: "bot" };
    return { allowed: false, reason: "shield" };
  }
  if (decision.isErrored()) console.error("Arcjet errored; allowing the request (fail open):", decision.reason.message);
  return ALLOWED;
}

/** Runs an Arcjet check. If it throws (e.g. no `ARCJET_KEY`), logs and allows (fail open). */
export async function failOpen(check: () => Promise<ArcjetDecision>): Promise<ProtectResult> {
  try {
    return toProtectResult(await check());
  } catch (cause) {
    console.error("Arcjet check failed; allowing the request (fail open):", cause);
    return ALLOWED;
  }
}
