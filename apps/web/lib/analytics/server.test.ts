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

import { captureServerEvent, captureServerException, getPostHogKey, resetAnalyticsClientForTests } from "./server";

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
