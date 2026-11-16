import "server-only";
import { PostHog } from "posthog-node";
import { readPostHogConfig } from "./config";
import type { AnalyticsEvent } from "./events";

type Properties = Record<string, unknown>;

export type ServerEvent = {
  event: AnalyticsEvent;
  /** The owner's Clerk user ID, so the event joins the person the browser identified. */
  distinctId: string;
  properties?: Properties;
};

let cached: { id: string; client: PostHog } | null = null;

/**
 * One client per key and host, created on first use. It sends each event as its own request
 * and awaits it (`*Immediate`), because a serverless function may freeze right after the
 * response, before a background batch would flush.
 */
function getClient(): PostHog | null {
  const config = readPostHogConfig(process.env);
  if (!config) return null;

  const id = `${config.key}@${config.host}`;
  if (cached?.id !== id) {
    const client = new PostHog(config.key, {
      host: config.host,
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 3_000,
      fetchRetryCount: 1,
    });
    // posthog-node reports failed requests here rather than rejecting.
    client.on("error", (error: unknown) => console.error("[analytics] PostHog request failed", error));
    cached = { id, client };
  }
  return cached.client;
}

/**
 * Captures a product event (project.md §6.11) from the server. Never throws: analytics must
 * not break the action that triggered it. Does nothing when PostHog isn't configured.
 */
export async function captureServerEvent({ event, distinctId, properties }: ServerEvent): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;
    await client.captureImmediate({ event, distinctId, properties });
  } catch (error) {
    console.error(`[analytics] Couldn't capture "${event}"`, error);
  }
}

/**
 * Sends a server error to PostHog error tracking. Never throws; does nothing without a key.
 * `distinctId` links it to a person when known; otherwise PostHog records it anonymously.
 */
export async function captureServerException(
  error: unknown,
  distinctId?: string,
  properties?: Properties,
): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;
    await client.captureExceptionImmediate(error, distinctId, properties);
  } catch (captureError) {
    console.error("[analytics] Couldn't capture an exception", captureError);
  }
}

/** The project key, for reading posthog-js's cookie. Null when PostHog isn't configured. */
export function getPostHogKey(): string | null {
  return readPostHogConfig(process.env)?.key ?? null;
}

/** Test-only: forget the cached client so the next call reads the environment again. */
export function resetAnalyticsClientForTests(): void {
  cached = null;
}
