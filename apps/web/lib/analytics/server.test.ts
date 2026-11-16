import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { PostHog, captureImmediate, captureExceptionImmediate, on } = vi.hoisted(() => {
  const captureImmediate = vi.fn();
  const captureExceptionImmediate = vi.fn();
  const on = vi.fn();
  const PostHog = vi.fn(function () {
    return { captureImmediate, captureExceptionImmediate, on };
  });
  return { PostHog, captureImmediate, captureExceptionImmediate, on };
});
vi.mock("posthog-node", () => ({ PostHog }));

import { captureAiEvent, captureServerEvent, captureServerException, getPostHogKey, resetAnalyticsClientForTests } from "./server";

function configure() {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
}

beforeEach(() => {
  resetAnalyticsClientForTests();
  vi.clearAllMocks();
  captureImmediate.mockResolvedValue(undefined);
  captureExceptionImmediate.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("captureServerEvent", () => {
  test("no key: does nothing", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");

    await expect(captureServerEvent({ event: "project_created", distinctId: "user_1" })).resolves.toBeUndefined();
    expect(PostHog).not.toHaveBeenCalled();
    expect(captureImmediate).not.toHaveBeenCalled();
    expect(getPostHogKey()).toBeNull();
  });

  test("sends the event right away with the key and host from the environment", async () => {
    configure();

    await captureServerEvent({ event: "project_created", distinctId: "user_1", properties: { plan: "free" } });

    expect(PostHog).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({ host: "https://us.i.posthog.com", flushAt: 1, flushInterval: 0 }),
    );
    expect(captureImmediate).toHaveBeenCalledWith({
      event: "project_created",
      distinctId: "user_1",
      properties: { plan: "free" },
    });
    expect(on).toHaveBeenCalledWith("error", expect.any(Function));
  });

  test("reuses one client while the config stays the same", async () => {
    configure();
    await captureServerEvent({ event: "first_chat", distinctId: "user_1" });
    await captureServerEvent({ event: "first_chat", distinctId: "user_2" });
    expect(PostHog).toHaveBeenCalledTimes(1);
  });

  test("PostHog error: swallowed and logged", async () => {
    configure();
    const failure = new Error("network down");
    captureImmediate.mockRejectedValue(failure);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(captureServerEvent({ event: "upgraded", distinctId: "user_1" })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('[analytics] Couldn\'t capture "upgraded"', failure);
  });

  test("client creation error: swallowed and logged", async () => {
    configure();
    PostHog.mockImplementationOnce(function () {
      throw new Error("bad options");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(captureServerEvent({ event: "signed_up", distinctId: "user_1" })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
  });

  test("failed requests reported by posthog-node are logged", async () => {
    configure();
    await captureServerEvent({ event: "signed_up", distinctId: "user_1" });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const handler = on.mock.calls[0]?.[1] as (error: unknown) => void;
    handler(new Error("503"));
    expect(log).toHaveBeenCalledWith("[analytics] PostHog request failed", expect.any(Error));
  });
});

describe("captureServerException", () => {
  test("no key: does nothing", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    await captureServerException(new Error("boom"));
    expect(captureExceptionImmediate).not.toHaveBeenCalled();
  });

  test("sends the error with the distinct ID and properties", async () => {
    configure();
    const error = new Error("boom");
    await captureServerException(error, "user_1", { route_path: "/api/x" });
    expect(captureExceptionImmediate).toHaveBeenCalledWith(error, "user_1", { route_path: "/api/x" });
  });

  test("PostHog error: swallowed and logged", async () => {
    configure();
    captureExceptionImmediate.mockRejectedValue(new Error("network down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(captureServerException(new Error("boom"))).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("[analytics] Couldn't capture an exception", expect.any(Error));
  });
});

describe("captureAiEvent", () => {
  const properties = { $ai_trace_id: "conv_1", $ai_model: "gpt-6-luna", $ai_input_tokens: 10, $ai_output_tokens: 2 };

  test("sends the event on the same client as product events", async () => {
    configure();

    await captureServerEvent({ event: "first_chat", distinctId: "user_1" });
    await captureAiEvent({ event: "$ai_generation", distinctId: "visitor_1", properties });

    expect(PostHog).toHaveBeenCalledTimes(1);
    expect(captureImmediate).toHaveBeenLastCalledWith({ event: "$ai_generation", distinctId: "visitor_1", properties });
  });

  test("never sends $ai_input or $ai_output_choices", async () => {
    configure();

    await captureAiEvent({
      event: "$ai_generation",
      distinctId: "visitor_1",
      properties: {
        ...properties,
        $ai_input: [{ role: "user", content: "secret question" }],
        $ai_output_choices: [{ role: "assistant", content: "secret answer" }],
      },
    });

    expect(captureImmediate).toHaveBeenCalledWith({ event: "$ai_generation", distinctId: "visitor_1", properties });
    expect(JSON.stringify(captureImmediate.mock.calls)).not.toContain("secret");
  });

  test("no key: does nothing", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");

    await captureAiEvent({ event: "$ai_generation", distinctId: "visitor_1", properties });
    expect(captureImmediate).not.toHaveBeenCalled();
  });

  test("never throws when PostHog fails", async () => {
    configure();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    captureImmediate.mockRejectedValue(new Error("down"));

    await expect(captureAiEvent({ event: "$ai_generation", distinctId: "visitor_1", properties })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('[analytics] Couldn\'t capture "$ai_generation"', expect.any(Error));
  });
});
