import { conversationResponseSchema } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as setup from "../../../../lib/conversations/test-setup";

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/auth/require-owner", async () =>
  (await import("../../../../lib/conversations/test-setup")).mocks.requireOwner(),
);
vi.mock("../../../../lib/supabase/owner", async () =>
  (await import("../../../../lib/conversations/test-setup")).mocks.owner(),
);

const { GET } = await import("./route");
const { CONVERSATION_ID, OTHER_CONVERSATION_ID, OTHER_PROJECT_ID, PROJECT_ID, state, conversation, message } = setup;

function get(id = CONVERSATION_ID) {
  return GET(new Request(`http://localhost/api/conversations/${id}`), setup.ctx(id));
}

beforeEach(() => {
  setup.resetState();
  state.conversations = [conversation(), conversation({ id: OTHER_CONVERSATION_ID, project_id: OTHER_PROJECT_ID })];
});

describe("GET /api/conversations/:id", () => {
  it("returns the conversation and its thread, oldest first", async () => {
    const first = message({ body: "Hi", created_at: "2026-11-14T10:00:01.000000+00:00" });
    const second = message({ role: "bot", body: "<b>Hello</b>", created_at: "2026-11-14T10:00:02.000000+00:00" });
    const third = message({ body: "Thanks", created_at: "2026-11-14T10:00:03.000000+00:00" });
    state.messages = [third, first, second, message({ conversation_id: OTHER_CONVERSATION_ID })];

    const res = await get();

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = conversationResponseSchema.parse(await res.json());
    expect(body.conversation).toEqual({
      id: CONVERSATION_ID,
      projectId: PROJECT_ID,
      visitorId: "v_visitor",
      createdAt: "2026-11-14T10:00:00.000000+00:00",
    });
    expect(body.messages).toEqual(
      [first, second, third].map((m) => ({ id: m.id, role: m.role, body: m.body, createdAt: m.created_at })),
    );
  });

  it("returns a conversation with no messages", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(conversationResponseSchema.parse(await res.json()).messages).toEqual([]);
  });

  it("401s when signed out", async () => {
    state.signedIn = false;
    const res = await get();
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toMatchObject({ error: { code: "unauthorized" } });
    expect(setup.queries).toHaveLength(0);
  });

  it("404s for another owner's conversation, the same as a missing one", async () => {
    const other = await get(OTHER_CONVERSATION_ID);
    const missing = await get("77777777-7777-4777-8777-777777777777");
    for (const res of [other, missing]) {
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("no-store");
      await expect(res.json()).resolves.toEqual({ error: { code: "not_found", message: "Conversation not found." } });
    }
    // RLS hid the conversation, so its messages were never read.
    expect(setup.queries.every((q) => q.table === "conversations")).toBe(true);
  });

  it("400s for an id that isn't a UUID", async () => {
    const res = await get("not-a-uuid");
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toMatchObject({ error: { code: "invalid_request" } });
    expect(setup.queries).toHaveLength(0);
  });

  it("500s without details on a database error", async () => {
    state.dbError = "boom";
    const res = await get();
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("boom");
  });
});
