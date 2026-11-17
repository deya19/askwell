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

const { fakeAccountsTable } = await import("./billing/test-helpers");
const accounts = fakeAccountsTable();
const table = accounts.rows;
const createServiceClient = vi.fn(() => accounts.client);
vi.mock("./supabase/service", () => ({ createServiceClient }));

const { ensureAccount, setAccountPlan } = await import("./accounts");
const { resetAnalyticsClientForTests } = await import("./analytics/server");

describe("ensureAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    table.clear();
    userId = "user_new";
    accounts.state.failWith = null;
    accounts.state.beforeInsert = null;
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
    accounts.state.failWith = "boom";
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
      accounts.state.failWith = "boom";
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

  describe("setAccountPlan", () => {
    const upgraded = () => captureImmediate.mock.calls.filter(([e]) => (e as { event: string }).event === "upgraded");

    it("free → pro: sets pro and sends upgraded once, for the Clerk user ID", async () => {
      table.set("user_payer", { clerk_user_id: "user_payer", plan: "free" });

      await expect(setAccountPlan("user_payer", "pro")).resolves.toEqual({ changed: true });

      expect(table.get("user_payer")?.plan).toBe("pro");
      expect(upgraded()).toEqual([[{ event: "upgraded", distinctId: "user_payer" }]]);
    });

    it("is idempotent: a replay changes nothing and sends no second upgraded", async () => {
      table.set("user_payer", { clerk_user_id: "user_payer", plan: "free" });

      await setAccountPlan("user_payer", "pro");
      await expect(setAccountPlan("user_payer", "pro")).resolves.toEqual({ changed: false });

      expect(table.get("user_payer")?.plan).toBe("pro");
      expect(upgraded()).toHaveLength(1);
    });

    it("creates a missing account on pro, which counts as an upgrade", async () => {
      await expect(setAccountPlan("user_payer", "pro")).resolves.toEqual({ changed: true });

      expect([...table.values()]).toEqual([{ clerk_user_id: "user_payer", plan: "pro" }]);
      expect(upgraded()).toHaveLength(1);
    });

    it("pro → free: sets free, sends no upgraded", async () => {
      table.set("user_payer", { clerk_user_id: "user_payer", plan: "pro" });

      await expect(setAccountPlan("user_payer", "free")).resolves.toEqual({ changed: true });

      expect(table.get("user_payer")?.plan).toBe("free");
      expect(captureImmediate).not.toHaveBeenCalled();
    });

    it("creates a missing account on free without calling it a change", async () => {
      await expect(setAccountPlan("user_payer", "free")).resolves.toEqual({ changed: false });
      expect([...table.values()]).toEqual([{ clerk_user_id: "user_payer", plan: "free" }]);
    });

    it("still sets pro when ensureAccount creates the free row in between (race)", async () => {
      accounts.state.beforeInsert = () => table.set("user_payer", { clerk_user_id: "user_payer", plan: "free" });

      await expect(setAccountPlan("user_payer", "pro")).resolves.toEqual({ changed: true });

      expect(table.get("user_payer")?.plan).toBe("pro");
      expect(upgraded()).toHaveLength(1);
    });

    it("throws on a database error, without sending upgraded", async () => {
      accounts.state.failWith = "boom";
      await expect(setAccountPlan("user_payer", "pro")).rejects.toThrow("Could not update plan: boom");
      expect(captureImmediate).not.toHaveBeenCalled();
    });

    it("a PostHog failure doesn't fail the plan change", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      captureImmediate.mockRejectedValue(new Error("posthog down"));

      await expect(setAccountPlan("user_payer", "pro")).resolves.toEqual({ changed: true });
      expect(table.get("user_payer")?.plan).toBe("pro");
    });
  });
});
