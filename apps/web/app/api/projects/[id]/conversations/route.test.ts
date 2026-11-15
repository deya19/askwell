import { listConversationsResponseSchema } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as setup from "../../../../../lib/conversations/test-setup";

vi.mock("server-only", () => ({}));
vi.mock("../../../../../lib/auth/require-owner", async () =>
  (await import("../../../../../lib/conversations/test-setup")).mocks.requireOwner(),
);
vi.mock("../../../../../lib/supabase/owned-project", async () =>
  (await import("../../../../../lib/conversations/test-setup")).mocks.ownedProject(),
);
vi.mock("../../../../../lib/supabase/owner", async () =>
  (await import("../../../../../lib/conversations/test-setup")).mocks.owner(),
);

const { GET } = await import("./route");
const { PROJECT_ID, OTHER_PROJECT_ID, state, conversation, message } = setup;

function get(id = PROJECT_ID) {
  return GET(new Request(`http://localhost/api/projects/${id}/conversations`), setup.ctx(id));
}

beforeEach(() => setup.resetState());

describe("GET /api/projects/:id/conversations", () => {
  it("returns the conversations newest first, with preview and message count", async () => {
    const older = "66666666-6666-4666-8666-666666666666";
    state.conversations = [
      conversation({ id: older, created_at: "2026-11-13T09:00:00.000000+00:00", visitor_id: "v_old" }),
      conversation({ created_at: "2026-11-14T09:00:00.000000+00:00" }),
      // Another owner's project: RLS hides it.
      conversation({ id: setup.OTHER_CONVERSATION_ID, project_id: OTHER_PROJECT_ID }),
    ];
    state.messages = [
      message({ body: "Where is my order?" }),
      message({ role: "bot", body: "Let me check." }),
      message({ conversation_id: older }),
    ];

    const res = await get();

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = listConversationsResponseSchema.parse(await res.json());
    expect(body.conversations).toEqual([
      {
        id: setup.CONVERSATION_ID,
        visitorId: "v_visitor",
        preview: "Where is my order?",
        messageCount: 2,
        createdAt: "2026-11-14T09:00:00.000000+00:00",
      },
      { id: older, visitorId: "v_old", preview: "Hello", messageCount: 1, createdAt: "2026-11-13T09:00:00.000000+00:00" },
    ]);
  });

  it("returns an empty list for a project with no conversations", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(listConversationsResponseSchema.parse(await res.json())).toEqual({ conversations: [] });
    // No messages query when there's nothing to count.
    expect(setup.queries.map((q) => q.table)).toEqual(["conversations"]);
  });

  it("401s when signed out", async () => {
    state.signedIn = false;
    const res = await get();
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toMatchObject({ error: { code: "unauthorized" } });
    expect(setup.queries).toHaveLength(0);
  });

  it("404s for another owner's project, without reading conversations", async () => {
    state.conversations = [conversation({ project_id: OTHER_PROJECT_ID })];
    const res = await get(OTHER_PROJECT_ID);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ error: { code: "not_found", message: "Project not found." } });
    expect(setup.queries).toHaveLength(0);
  });

  it("404s for an id that isn't a UUID", async () => {
    const res = await get("not-a-uuid");
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "not_found" } });
  });

  it("500s without details on a database error", async () => {
    state.dbError = "boom";
    const res = await get();
    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("boom");
  });
});
