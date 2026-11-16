import { PLAN_LIMITS, knowledgeSourceResponseSchema } from "@askwell/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as setup from "../../../../../lib/knowledge/route-test-setup";

vi.mock("server-only", () => ({}));

// PostHog under the real capture helper: events go to `captureImmediate`.
const { captureImmediate } = vi.hoisted(() => ({ captureImmediate: vi.fn() }));
vi.mock("posthog-node", () => ({
  PostHog: vi.fn(function () {
    return { captureImmediate, on: vi.fn() };
  }),
}));
vi.mock("next/server", async () => (await import("../../../../../lib/knowledge/route-test-setup")).mocks.nextServer());
vi.mock("../../../../../lib/auth/require-owner", async () =>
  (await import("../../../../../lib/knowledge/route-test-setup")).mocks.requireOwner(),
);
vi.mock("../../../../../lib/supabase/owned-project", async () =>
  (await import("../../../../../lib/knowledge/route-test-setup")).mocks.ownedProject(),
);
vi.mock("../../../../../lib/supabase/owner", async () =>
  (await import("../../../../../lib/knowledge/route-test-setup")).mocks.owner(),
);
vi.mock("../../../../../lib/supabase/service", async () =>
  (await import("../../../../../lib/knowledge/route-test-setup")).mocks.service(),
);
vi.mock("../../../../../lib/knowledge/process", async () =>
  (await import("../../../../../lib/knowledge/route-test-setup")).mocks.process(),
);

const { POST, maxDuration } = await import("./route");
const { resetAnalyticsClientForTests } = await import("../../../../../lib/analytics/server");

/** PostHog configured, events accepted. Call after `setup.resetState()`. */
function resetAnalytics(): void {
  resetAnalyticsClientForTests();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
  captureImmediate.mockResolvedValue(undefined);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const { PROJECT_ID, OTHER_PROJECT_ID, SOURCE_ID, service, state } = setup;

const URL = `http://localhost/api/projects/${PROJECT_ID}/knowledge`;
const body = { title: "  Shipping FAQ ", content: "We ship worldwide.\n\nReturns take 30 days." };

beforeEach(() => {
  setup.resetState();
  resetAnalytics();
});

describe("POST /api/projects/:id/knowledge", () => {
  it("reserves a text source with the plan's limit, responds 201, then processes it", async () => {
    const res = await POST(setup.jsonPost(URL, body), setup.ctx(PROJECT_ID));

    expect(res.status).toBe(201);
    const json = knowledgeSourceResponseSchema.parse(await res.json());
    expect(json.source).toMatchObject({ id: SOURCE_ID, projectId: PROJECT_ID, type: "text", status: "processing" });

    expect(service.rpc).toHaveBeenCalledWith("reserve_knowledge_source", {
      project_id: PROJECT_ID,
      title: "Shipping FAQ",
      type: "text",
      max_sources: PLAN_LIMITS.free.knowledgeSources,
      storage_key: undefined,
    });

    // Processing runs after the response.
    expect(setup.processKnowledgeSource).not.toHaveBeenCalled();
    await setup.runAfter();
    expect(setup.processKnowledgeSource).toHaveBeenCalledWith(
      service.client,
      { id: SOURCE_ID, projectId: PROJECT_ID, type: "text" },
      { kind: "text", text: body.content.trim() },
    );
  });

  it("uses the Pro limit for a Pro owner", async () => {
    state.plan = "pro";
    await POST(setup.jsonPost(URL, body), setup.ctx(PROJECT_ID));
    expect(service.rpc.mock.calls[0]?.[1]).toMatchObject({ max_sources: PLAN_LIMITS.pro.knowledgeSources });
  });

  it("returns 402 limit_reached at the plan's limit, and processes nothing", async () => {
    service.rpcResult.current = { data: null, error: { code: "AWL02", message: "source_limit_reached" } };

    const res = await POST(setup.jsonPost(URL, body), setup.ctx(PROJECT_ID));

    expect(res.status).toBe(402);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "limit_reached" } });
    expect(setup.afterCallbacks).toHaveLength(0);
  });

  it("returns 401 when signed out, without touching the database", async () => {
    state.signedIn = false;
    const res = await POST(setup.jsonPost(URL, body), setup.ctx(PROJECT_ID));
    expect(res.status).toBe(401);
    expect(service.client.from).not.toHaveBeenCalled();
    expect(service.rpc).not.toHaveBeenCalled();
  });

  it("returns 404 for another owner's project, without a service-client call", async () => {
    const res = await POST(setup.jsonPost(URL, body), setup.ctx(OTHER_PROJECT_ID));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "not_found" } });
    expect(service.rpc).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid body", async () => {
    const empty = await POST(setup.jsonPost(URL, { title: "x", content: "   " }), setup.ctx(PROJECT_ID));
    expect(empty.status).toBe(400);
    const notJson = await POST(setup.jsonPost(URL, "{nope"), setup.ctx(PROJECT_ID));
    expect(notJson.status).toBe(400);
    expect(service.rpc).not.toHaveBeenCalled();
  });

  it("returns 409 when the account row doesn't exist yet", async () => {
    state.plan = null;
    const res = await POST(setup.jsonPost(URL, body), setup.ctx(PROJECT_ID));
    expect(res.status).toBe(409);
    expect(service.rpc).not.toHaveBeenCalled();
  });

  it("returns 500 without details on a database error", async () => {
    service.rpcResult.current = { data: null, error: { code: "XX000", message: "secret detail" } };
    const res = await POST(setup.jsonPost(URL, body), setup.ctx(PROJECT_ID));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret detail");
  });

  it("allows enough time to process after responding", () => {
    expect(maxDuration).toBeGreaterThanOrEqual(300);
  });
});

describe("POST /api/projects/:id/knowledge: knowledge_added", () => {
  it("is sent once with the owner's user ID, the project ID and type text: no title or content", async () => {
    const res = await POST(setup.jsonPost(URL, body), setup.ctx(PROJECT_ID));

    expect(res.status).toBe(201);
    expect(captureImmediate).toHaveBeenCalledTimes(1);
    expect(captureImmediate).toHaveBeenCalledWith({
      event: "knowledge_added",
      distinctId: setup.USER_ID,
      properties: { project_id: PROJECT_ID, type: "text" },
    });
    const sent = JSON.stringify(captureImmediate.mock.calls);
    expect(sent).not.toContain("Shipping FAQ");
    expect(sent).not.toContain("We ship worldwide");
  });

  it("isn't sent when the source isn't added", async () => {
    service.rpcResult.current = { data: null, error: { code: "AWL02", message: "source_limit_reached" } };
    await POST(setup.jsonPost(URL, body), setup.ctx(PROJECT_ID));
    await POST(setup.jsonPost(URL, {}), setup.ctx(PROJECT_ID));
    await POST(setup.jsonPost(URL, body), setup.ctx(OTHER_PROJECT_ID));

    expect(captureImmediate).not.toHaveBeenCalled();
  });

  it("a PostHog failure doesn't fail the route or the processing", async () => {
    captureImmediate.mockRejectedValue(new Error("posthog down"));

    const res = await POST(setup.jsonPost(URL, body), setup.ctx(PROJECT_ID));

    expect(res.status).toBe(201);
    await setup.runAfter();
    expect(setup.processKnowledgeSource).toHaveBeenCalledTimes(1);
  });
});
