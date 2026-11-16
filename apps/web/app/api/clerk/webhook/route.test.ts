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

// The real verifyWebhook and setAccountPlan run; only the database is faked.
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
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/clerk/webhook", () => {
  it("Pro item active → plan pro, 200, and one upgraded for the payer", async () => {
    const res = await deliver("subscriptionItem.active");

    expect(res.status).toBe(200);
    expect(plan()).toBe("pro");
    expect(upgraded()).toEqual([[{ event: "upgraded", distinctId: USER }]]);
  });

  it("Pro item ended → plan free", async () => {
    accounts.rows.set(USER, { clerk_user_id: USER, plan: "pro" });

    const res = await deliver("subscriptionItem.ended");

    expect(res.status).toBe(200);
    expect(plan()).toBe("free");
    expect(upgraded()).toHaveLength(0);
  });

  it("a cancel event alone keeps pro", async () => {
    accounts.rows.set(USER, { clerk_user_id: USER, plan: "pro" });

    const res = await deliver("subscriptionItem.canceled");

    expect(res.status).toBe(200);
    expect(plan()).toBe("pro");
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it.each([
    ["another plan's active item", () => deliver("subscriptionItem.active", { slug: "free_user" })],
    ["another plan's ended item", () => deliver("subscriptionItem.ended", { slug: "free_user" })],
    ["an organization payer", () => deliver("subscriptionItem.active", { userId: undefined, organizationId: "org_1" })],
    ["another event type", () => POST(signedRequest({ object: "event", type: "user.created", data: { id: USER } }))],
    ["a subscription-level event", () => deliver("subscription.active")],
  ])("%s → 200, no write", async (_, send) => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(plan()).toBe("free");
  });

  it("a replayed event gives the same result and one upgraded", async () => {
    const first = await deliver("subscriptionItem.active", undefined, "msg_replay");
    const replay = await deliver("subscriptionItem.active", undefined, "msg_replay");

    expect([first.status, replay.status]).toEqual([200, 200]);
    expect(plan()).toBe("pro");
    expect(upgraded()).toHaveLength(1);
  });

  it("creates a missing account with the plan", async () => {
    accounts.rows.clear();

    await deliver("subscriptionItem.active");

    expect([...accounts.rows.values()]).toEqual([{ clerk_user_id: USER, plan: "pro" }]);
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
    accounts.state.failWith = "relation secret_table does not exist";

    const res = await deliver("subscriptionItem.active");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ error: { code: "internal_error" } });
    expect(JSON.stringify(body)).not.toContain("secret_table");
  });

  it("a PostHog failure still returns 200 with the plan set", async () => {
    captureImmediate.mockRejectedValue(new Error("posthog down"));

    const res = await deliver("subscriptionItem.active");

    expect(res.status).toBe(200);
    expect(plan()).toBe("pro");
  });
});
