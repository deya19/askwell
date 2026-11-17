import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// PostHog under the real capture helper: events go to `captureImmediate`.
const { captureImmediate } = vi.hoisted(() => ({ captureImmediate: vi.fn() }));
vi.mock("posthog-node", () => ({
  PostHog: vi.fn(function () {
    return { captureImmediate, on: vi.fn() };
  }),
}));

// Clerk's Billing API: the user's current subscription items. The route reads them on every event.
type Item = { status: string; plan: { slug: string } | null; periodEnd: number | null };
const { getUserBillingSubscription } = vi.hoisted(() => ({ getUserBillingSubscription: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ billing: { getUserBillingSubscription } }),
}));
const DAY = 24 * 60 * 60 * 1000;
const item = (status: string, slug = "pro", periodEnd: number | null = Date.now() + 10 * DAY): Item => ({
  status,
  plan: { slug },
  periodEnd,
});
/** Clerk now reports these items for the user. */
const clerkHas = (...items: Item[]) => getUserBillingSubscription.mockResolvedValue({ subscriptionItems: items });

// The real verifyWebhook and setAccountPlan run; only the database and Clerk's API are faked.
const { fakeAccountsTable, signedRequest, subscriptionItemEvent, TEST_SIGNING_SECRET } = await import(
  "../../../../lib/billing/test-helpers"
);
const accounts = fakeAccountsTable();
const createServiceClient = vi.fn(() => accounts.client);
vi.mock("../../../../lib/supabase/service", () => ({ createServiceClient }));

const route = await import("./route");
const POST = (request: Request) => route.POST(new NextRequest(request));
const { resetAnalyticsClientForTests } = await import("../../../../lib/analytics/server");

const USER = "user_payer";
const plan = () => accounts.rows.get(USER)?.plan;
const upgraded = () => captureImmediate.mock.calls.filter(([e]) => (e as { event: string }).event === "upgraded");
const deliver = (type: string, options?: Parameters<typeof subscriptionItemEvent>[1], id?: string) =>
  POST(signedRequest(subscriptionItemEvent(type, options), { id }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  accounts.rows.clear();
  accounts.rows.set(USER, { clerk_user_id: USER, plan: "free" });
  accounts.state.failWith = null;
  accounts.state.beforeInsert = null;
  vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", TEST_SIGNING_SECRET);
  resetAnalyticsClientForTests();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
  captureImmediate.mockResolvedValue(undefined);
  clerkHas(item("active", "free_user"));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/clerk/webhook", () => {
  it("Pro item active in Clerk → plan pro, 200, and one upgraded for the payer", async () => {
    clerkHas(item("active"));

    const res = await deliver("subscriptionItem.active");

    expect(res.status).toBe(200);
    expect(getUserBillingSubscription).toHaveBeenCalledWith(USER);
    expect(plan()).toBe("pro");
    expect(upgraded()).toEqual([[{ event: "upgraded", distinctId: USER }]]);
  });

  it("Pro item ended in Clerk → plan free", async () => {
    accounts.rows.set(USER, { clerk_user_id: USER, plan: "pro" });
    clerkHas(item("ended", "pro", Date.now() - DAY), item("active", "free_user"));

    const res = await deliver("subscriptionItem.ended");

    expect(res.status).toBe(200);
    expect(plan()).toBe("free");
    expect(upgraded()).toHaveLength(0);
  });

  it("a cancel within the paid period keeps pro", async () => {
    accounts.rows.set(USER, { clerk_user_id: USER, plan: "pro" });
    clerkHas(item("canceled"));

    const res = await deliver("subscriptionItem.canceled");

    expect(res.status).toBe(200);
    expect(plan()).toBe("pro");
  });

  describe("delivery order doesn't matter: Clerk's current state wins", () => {
    it("an old ended arriving after a newer active stays pro", async () => {
      clerkHas(item("active"));

      await deliver("subscriptionItem.active");
      const late = await deliver("subscriptionItem.ended");

      expect(late.status).toBe(200);
      expect(plan()).toBe("pro");
      expect(upgraded()).toHaveLength(1);
    });

    it("an old active arriving after a newer ended stays free", async () => {
      accounts.rows.set(USER, { clerk_user_id: USER, plan: "pro" });
      clerkHas(item("ended", "pro", Date.now() - DAY));

      await deliver("subscriptionItem.ended");
      const late = await deliver("subscriptionItem.active");

      expect(late.status).toBe(200);
      expect(plan()).toBe("free");
      expect(upgraded()).toHaveLength(0);
    });

    it("pro → free → pro with a stale ended delivered last stays pro", async () => {
      clerkHas(item("active"));
      await deliver("subscriptionItem.active");
      clerkHas(item("ended", "pro", Date.now() - DAY));
      await deliver("subscriptionItem.ended", undefined, "msg_end");
      clerkHas(item("active"));
      await deliver("subscriptionItem.active");

      const stale = await deliver("subscriptionItem.ended", undefined, "msg_end_redelivered");

      expect(stale.status).toBe(200);
      expect(plan()).toBe("pro");
    });
  });

  it.each([
    ["an organization payer", () => deliver("subscriptionItem.active", { userId: undefined, organizationId: "org_1" })],
    ["another event type", () => POST(signedRequest({ object: "event", type: "user.created", data: { id: USER } }))],
    ["a subscription-level event", () => deliver("subscription.active")],
  ])("%s → 200, no Clerk call, no write", async (_, send) => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(getUserBillingSubscription).not.toHaveBeenCalled();
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(plan()).toBe("free");
  });

  it("another plan's event still re-reads Clerk (e.g. a switch to Pro)", async () => {
    clerkHas(item("ended", "free_user", Date.now() - DAY), item("active"));

    const res = await deliver("subscriptionItem.ended", { slug: "free_user" });

    expect(res.status).toBe(200);
    expect(plan()).toBe("pro");
  });

  it("a replayed event gives the same result and one upgraded", async () => {
    clerkHas(item("active"));

    const first = await deliver("subscriptionItem.active", undefined, "msg_replay");
    const replay = await deliver("subscriptionItem.active", undefined, "msg_replay");

    expect([first.status, replay.status]).toEqual([200, 200]);
    expect(plan()).toBe("pro");
    expect(upgraded()).toHaveLength(1);
  });

  it("creates a missing account with the plan", async () => {
    accounts.rows.clear();
    clerkHas(item("active"));

    await deliver("subscriptionItem.active");

    expect([...accounts.rows.values()]).toEqual([{ clerk_user_id: USER, plan: "pro" }]);
  });

  it("no subscription in Clerk (404) → free", async () => {
    accounts.rows.set(USER, { clerk_user_id: USER, plan: "pro" });
    const { ClerkAPIResponseError } = await import("@clerk/nextjs/errors");
    getUserBillingSubscription.mockRejectedValue(new ClerkAPIResponseError("Not Found", { data: [], status: 404 }));

    const res = await deliver("subscriptionItem.ended");

    expect(res.status).toBe(200);
    expect(plan()).toBe("free");
  });

  it("a Clerk API error → 500 and no write, so Clerk retries", async () => {
    accounts.rows.set(USER, { clerk_user_id: USER, plan: "pro" });
    getUserBillingSubscription.mockRejectedValue(new Error("clerk unavailable"));

    const res = await deliver("subscriptionItem.ended");

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "internal_error" } });
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(plan()).toBe("pro");
  });

  describe("a bad or missing signature → 400 and no write", () => {
    const event = subscriptionItemEvent("subscriptionItem.active");

    it.each([
      ["signed with another secret", () => signedRequest(event, { secret: `whsec_${Buffer.from("another secret key!!").toString("base64")}` })],
      ["no signature headers", () => new Request("http://localhost/api/clerk/webhook", { method: "POST", body: JSON.stringify(event) })],
      [
        "a body changed after signing",
        () => {
          const signed = signedRequest(event);
          const forged = JSON.stringify(subscriptionItemEvent("subscriptionItem.active", { userId: "user_attacker" }));
          return new Request(signed.url, { method: "POST", headers: signed.headers, body: forged });
        },
      ],
      ["an old timestamp (replay attack)", () => signedRequest(event, { timestamp: Math.floor(Date.now() / 1000) - 3600 })],
    ])("%s", async (_, request) => {
      const res = await POST(request());

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ error: { code: "invalid_request" } });
      expect(createServiceClient).not.toHaveBeenCalled();
      expect(plan()).toBe("free");
      expect(captureImmediate).not.toHaveBeenCalled();
    });

    it("no signing secret configured", async () => {
      vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", "");

      const res = await POST(signedRequest(event));

      expect(res.status).toBe(400);
      expect(createServiceClient).not.toHaveBeenCalled();
    });
  });

  it("a database error → 500 without details, so Clerk retries", async () => {
    clerkHas(item("active"));
    accounts.state.failWith = "relation secret_table does not exist";

    const res = await deliver("subscriptionItem.active");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ error: { code: "internal_error" } });
    expect(JSON.stringify(body)).not.toContain("secret_table");
  });

  it("a PostHog failure still returns 200 with the plan set", async () => {
    captureImmediate.mockRejectedValue(new Error("posthog down"));
    clerkHas(item("active"));

    const res = await deliver("subscriptionItem.active");

    expect(res.status).toBe(200);
    expect(plan()).toBe("pro");
  });
});
