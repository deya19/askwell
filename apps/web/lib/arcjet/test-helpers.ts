import type { ArcjetDecision } from "@arcjet/next";

type Kind = "rate_limit" | "prompt_injection" | "bot" | "shield";

/** A fake Arcjet decision, shaped like the parts `toProtectResult` reads. Tests only. */
export function fakeDecision(conclusion: "ALLOW" | "ERROR" | { deny: Kind }): ArcjetDecision {
  const kind = typeof conclusion === "object" ? conclusion.deny : undefined;
  const reason = {
    message: conclusion === "ERROR" ? "timeout" : undefined,
    isRateLimit: () => kind === "rate_limit",
    isPromptInjection: () => kind === "prompt_injection",
    isBot: () => kind === "bot",
    isShield: () => kind === "shield",
  };
  return {
    isDenied: () => kind !== undefined,
    isErrored: () => conclusion === "ERROR",
    reason,
  } as unknown as ArcjetDecision;
}
