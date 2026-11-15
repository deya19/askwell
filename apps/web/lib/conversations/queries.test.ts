import { beforeEach, describe, expect, it, vi } from "vitest";
import * as setup from "./test-setup";

vi.mock("server-only", () => ({}));
vi.mock("../supabase/owner", async () => (await import("./test-setup")).mocks.owner());

const { listConversations, getConversation, MESSAGE_PAGE_SIZE } = await import("./queries");
const { CONVERSATION_ID, PROJECT_ID, state, conversation, message } = setup;

beforeEach(() => setup.resetState());

describe("listConversations", () => {
  it("asks for the newest 100 conversations of the project", async () => {
    await listConversations(PROJECT_ID);
    const [query] = setup.queries;
    expect(query).toMatchObject({ table: "conversations", limit: 100 });
    expect(query!.filters).toContainEqual(["eq", "project_id", PROJECT_ID]);
    expect(query!.orders[0]).toEqual(["created_at", false]);
  });

  it("returns only 100 of 101 conversations", async () => {
    state.conversations = Array.from({ length: 101 }, (_, i) =>
      conversation({
        id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        created_at: `2026-11-14T10:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}+00:00`,
      }),
    );
    const { conversations } = await listConversations(PROJECT_ID);
    expect(conversations).toHaveLength(100);
    // The oldest one (i = 0) is the one left out.
    expect(conversations.at(-1)!.id).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("reads the messages of all listed conversations in one query when they fit a page", async () => {
    state.conversations = [conversation()];
    state.messages = [message(), message({ role: "bot" })];
    await listConversations(PROJECT_ID);
    const messageQueries = setup.queries.filter((q) => q.table === "messages");
    expect(messageQueries).toHaveLength(1);
    expect(messageQueries[0]!.filters).toContainEqual(["in", "conversation_id", [CONVERSATION_ID]]);
  });

  it("counts past one page of messages", async () => {
    state.conversations = [conversation()];
    state.messages = Array.from({ length: MESSAGE_PAGE_SIZE + 5 }, () => message({ role: "bot" }));
    const { conversations } = await listConversations(PROJECT_ID);
    expect(conversations[0]!.messageCount).toBe(MESSAGE_PAGE_SIZE + 5);
    expect(setup.queries.filter((q) => q.table === "messages")).toHaveLength(2);
  });

  it("throws on a database error", async () => {
    state.dbError = "boom";
    await expect(listConversations(PROJECT_ID)).rejects.toThrow("boom");
  });
});

describe("getConversation", () => {
  it("returns null when RLS hides the conversation", async () => {
    state.conversations = [conversation()];
    state.visibleProjects = [];
    await expect(getConversation(CONVERSATION_ID)).resolves.toBeNull();
  });
});
