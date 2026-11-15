import { posthogConfigResponseSchema } from "@askwell/shared";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/posthog-config", () => {
  test("returns the public key and host from the environment", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com/");

    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body: unknown = await response.json();
    expect(body).toEqual({ key: "phc_test", host: "https://us.i.posthog.com" });
    expect(posthogConfigResponseSchema.safeParse(body).success).toBe(true);
  });

  test("reads the environment on every request", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_one");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    expect(await GET().json()).toMatchObject({ key: "phc_one" });

    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_two");
    expect(await GET().json()).toMatchObject({ key: "phc_two" });
  });

  test("returns only the key and host", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
    expect(Object.keys((await GET().json()) as object).sort()).toEqual(["host", "key"]);
  });

  test.each([
    ["no key", "", "https://us.i.posthog.com"],
    ["no host", "phc_test", ""],
    ["an invalid host", "phc_test", "not a url"],
  ])("404 not_configured with %s", async (_label, key, host) => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", key);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", host);

    const response = GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "not_configured", message: "Analytics isn't configured." },
    });
  });
});
