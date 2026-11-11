import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getToken = vi.fn<() => Promise<string | null>>();
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ getToken })),
}));

type ClientOptions = { accessToken?: () => Promise<string | null> };
const createClient = vi.fn<(url: string, key: string, options: ClientOptions) => object>(() => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const { createOwnerClient } = await import("./owner");

function lastCall() {
  const call = createClient.mock.lastCall;
  if (!call) throw new Error("createClient was not called");
  return call;
}

describe("createOwnerClient", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
    createClient.mockClear();
    getToken.mockReset();
  });

  it("uses the URL and the publishable key, never the secret key", async () => {
    await createOwnerClient();
    const [url, key] = lastCall();
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("sb_publishable_test");
  });

  it("sends the owner's Clerk session token", async () => {
    getToken.mockResolvedValue("clerk-session-jwt");
    await createOwnerClient();
    const accessToken = lastCall()[2].accessToken;
    expect(accessToken).toBeTypeOf("function");
    await expect(accessToken?.()).resolves.toBe("clerk-session-jwt");
    expect(getToken).toHaveBeenCalledWith();
  });

  it("sends no token when signed out", async () => {
    getToken.mockResolvedValue(null);
    await createOwnerClient();
    await expect(lastCall()[2].accessToken?.()).resolves.toBeNull();
  });

  it("fails loudly when an env variable is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    await expect(createOwnerClient()).rejects.toThrow("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });
});
