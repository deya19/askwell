import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// PostHog under the real capture helper: events go to `captureImmediate`.
const { captureImmediate } = vi.hoisted(() => ({ captureImmediate: vi.fn() }));
vi.mock("posthog-node", () => ({
  PostHog: vi.fn(function () {
    return { captureImmediate, on: vi.fn() };
  }),
}));

let userId: string | null = "user_new";
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId })),
}));

type AccountRow = { clerk_user_id: string; plan: string };
type UpsertOptions = { onConflict?: string; ignoreDuplicates?: boolean };

/**
 * A fake `accounts` table that behaves like `insert … on conflict do nothing`:
 * a conflicting row is skipped, and only inserted rows come back from select().
 */
const table = new Map<string, AccountRow>();
let failWith: string | null = null;

const upsert = vi.fn((row: AccountRow, options: UpsertOptions) => ({
  select: vi.fn(async () => {
    if (failWith) return { data: null, error: { message: failWith } };
    if (table.has(row.clerk_user_id)) {
      if (!options.ignoreDuplicates) table.set(row.clerk_user_id, row);
      return { data: [], error: null };
    }
    table.set(row.clerk_user_id, row);
    return { data: [{ clerk_user_id: row.clerk_user_id }], error: null };
  }),
}));
const from = vi.fn(() => ({ upsert }));
const createServiceClient = vi.fn(() => ({ from }));
vi.mock("./supabase/service", () => ({ createServiceClient }));

const { ensureAccount } = await import("./accounts");
const { resetAnalyticsClientForTests } = await import("./analytics/server");

describe("ensureAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    table.clear();
    userId = "user_new";
    failWith = null;
    resetAnalyticsClientForTests();
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
    captureImmediate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("inserts a free account for the signed-in user", async () => {
    await expect(ensureAccount()).resolves.toEqual({ userId: "user_new", created: true });

    expect(from).toHaveBeenCalledWith("accounts");
    expect(upsert).toHaveBeenCalledWith(
      { clerk_user_id: "user_new", plan: "free" },
      { onConflict: "clerk_user_id", ignoreDuplicates: true },
    );
    expect([...table.values()]).toEqual([{ clerk_user_id: "user_new", plan: "free" }]);
  });

  it("is a no-op on the second call", async () => {
    await ensureAccount();
    await expect(ensureAccount()).resolves.toEqual({ userId: "user_new", created: false });
    expect(table.size).toBe(1);
  });

  it("never downgrades an existing account's plan", async () => {
    table.set("user_new", { clerk_user_id: "user_new", plan: "pro" });
    await expect(ensureAccount()).resolves.toEqual({ userId: "user_new", created: false });
    expect(table.get("user_new")?.plan).toBe("pro");
  });

  it("throws when nobody is signed in, without touching the database", async () => {
    userId = null;
    await expect(ensureAccount()).rejects.toThrow("signed-in user");
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("throws on a database error", async () => {
    failWith = "boom";
    await expect(ensureAccount()).rejects.toThrow("Could not create account: boom");
  });

  describe("signed_up", () => {
    it("is sent once, when the account is created, with the Clerk user ID and no properties", async () => {
      await ensureAccount();
      await ensureAccount();

      expect(captureImmediate).toHaveBeenCalledTimes(1);
      expect(captureImmediate).toHaveBeenCalledWith({ event: "signed_up", distinctId: "user_new" });
    });

    it("isn't sent for an existing account", async () => {
      table.set("user_new", { clerk_user_id: "user_new", plan: "free" });
      await ensureAccount();
      expect(captureImmediate).not.toHaveBeenCalled();
    });

    it("isn't sent when the insert fails", async () => {
      failWith = "boom";
      await expect(ensureAccount()).rejects.toThrow();
      expect(captureImmediate).not.toHaveBeenCalled();
    });

    it("a PostHog failure doesn't fail the account", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      captureImmediate.mockRejectedValue(new Error("posthog down"));

      await expect(ensureAccount()).resolves.toEqual({ userId: "user_new", created: true });
      expect(table.size).toBe(1);
    });
  });
});
