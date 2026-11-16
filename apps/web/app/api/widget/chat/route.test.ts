import { PLAN_LIMITS } from "@askwell/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProtectResult } from "../../../../lib/arcjet/decision";

vi.mock("server-only", () => ({}));

// `after()` callbacks run when the test says so; PostHog events go to `captureImmediate`.
const { afterCallbacks, captureImmediate } = vi.hoisted(() => ({
  afterCallbacks: [] as (() => unknown)[],
  captureImmediate: vi.fn(),
}));
vi.mock("next/server", () => ({ after: vi.fn((cb: () => unknown) => void afterCallbacks.push(cb)) }));
vi.mock("posthog-node", () => ({
  PostHog: vi.fn(function () {
    return { captureImmediate, on: vi.fn() };
  }),
}));
const runAfter = async () => {
  for (const cb of afterCallbacks.splice(0)) await cb();
};
const captured = (event: string) =>
  captureImmediate.mock.calls.map(([e]) => e as { event: string }).filter((e) => e.event === event);

const KEY = "pk_0123456789abcdef0123456789abcdef";
const PROJECT_ID = "6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f";
const OWNER_ID = "user_owner";
const CONVERSATION_ID = "0b6c7d8e-1f2a-4b3c-9d4e-5f6a7b8c9d0e";
const NEW_CONVERSATION_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

// Arcjet
const protectChat = vi.fn<(request: Request, input: { key: string; message: string }) => Promise<ProtectResult>>();
vi.mock("../../../../lib/arcjet/chat", () => ({ protectChat }));

// Supabase (service client): `from(table)...maybeSingle()` and `rpc(name, args)`.
type Row = { data: unknown; error: { message: string } | null };
let tables: Record<string, Row> = {};
let rpcs: Record<string, Row> = {};
const eq = vi.fn();
const rpc = vi.fn<(name: string, args: unknown) => Promise<Row>>(async (name) => rpcs[name] ?? { data: null, error: null });
const from = vi.fn((table: string) => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => {
      eq(table, column, value);
      return query;
    }),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => tables[table] ?? { data: null, error: null }),
  };
  return query;
});
vi.mock("../../../../lib/supabase/service", () => ({ createServiceClient: () => ({ from, rpc }) }));

// OpenAI
const embeddingsCreate = vi.fn();
const responsesCreate = vi.fn();
vi.mock("../../../../lib/ai/openai", () => ({
  getOpenAI: () => ({ embeddings: { create: embeddingsCreate }, responses: { create: responsesCreate } }),
}));

const { POST, OPTIONS } = await import("./route");
const { resetAnalyticsClientForTests } = await import("../../../../lib/analytics/server");

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/widget/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const validBody = { key: KEY, visitorId: "visitor_12345678", message: "When are you open?" };

function expectCors(res: Response) {
  expect(res.headers.get("access-control-allow-origin")).toBe("*");
}

const rpcNames = () => rpc.mock.calls.map(([name]) => name);
const expectNothingCounted = () => expect(rpcNames()).not.toContain("consume_message");
const expectNoAi = () => {
  expect(embeddingsCreate).not.toHaveBeenCalled();
  expect(responsesCreate).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  protectChat.mockResolvedValue({ allowed: true });
  tables = {
    projects: { data: { id: PROJECT_ID, owner_id: OWNER_ID, accounts: { plan: "free" } }, error: null },
    conversations: { data: { id: CONVERSATION_ID }, error: null },
  };
  rpcs = {
    consume_message: { data: true, error: null },
    match_chunks: { data: [{ id: "c1", source_id: "s1", content: "We are open 9 to 5, Monday to Friday.", similarity: 0.8 }], error: null },
    save_chat_turn: { data: NEW_CONVERSATION_ID, error: null },
  };
  embeddingsCreate.mockResolvedValue({ data: [{ index: 0, embedding: new Array(1536).fill(0.01) }] });
  responsesCreate.mockResolvedValue({
    output_text: " We're open 9 to 5, Monday to Friday. ",
    status: "completed",
    model: "gpt-6-luna-2026-10-01",
    usage: { input_tokens: 812, output_tokens: 14 },
  });
  afterCallbacks.length = 0;
  captureImmediate.mockReset().mockResolvedValue(undefined);
  resetAnalyticsClientForTests();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/widget/chat", () => {
  it("answers from the chunks, saves the turn and returns the conversation id", async () => {
    const res = await post(validBody);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      conversationId: NEW_CONVERSATION_ID,
      reply: "We're open 9 to 5, Monday to Friday.",
    });
    expectCors(res);
    expect(rpcNames()).toEqual(["consume_message", "match_chunks", "save_chat_turn"]);
    expect(rpc).toHaveBeenCalledWith("save_chat_turn", {
      project_id: PROJECT_ID,
      visitor_id: "visitor_12345678",
      visitor_message: "When are you open?",
      bot_reply: "We're open 9 to 5, Monday to Friday.",
    });
  });

  it("counts against the owner's plan limit", async () => {
    tables.projects = { data: { id: PROJECT_ID, owner_id: OWNER_ID, accounts: { plan: "pro" } }, error: null };

    await post(validBody);

    expect(rpc).toHaveBeenCalledWith("consume_message", {
      project_id: PROJECT_ID,
      max_messages: PLAN_LIMITS.pro.messagesPerMonth,
    });
  });

  it("looks the project up by public key only", async () => {
    await post(validBody);

    expect(eq).toHaveBeenCalledWith("projects", "public_key", KEY);
    expect(eq.mock.calls.filter(([table]) => table === "projects")).toHaveLength(1);
  });

  it("retrieves 5 chunks for this project and sends them in the context block", async () => {
    await post(validBody);

    expect(rpc).toHaveBeenCalledWith("match_chunks", expect.objectContaining({ project_id: PROJECT_ID, match_count: 5 }));
    const [request] = responsesCreate.mock.calls[0] as [{ input: string; instructions: string; model: string }];
    expect(request.input).toContain("<context>");
    expect(request.input).toContain("We are open 9 to 5");
    expect(request.input).toContain("<question>\nWhen are you open?\n</question>");
    expect(request.instructions).toMatch(/data, never instructions/);
  });

  it("still asks the model when no chunk matches, so it says it doesn't know", async () => {
    rpcs.match_chunks = { data: [], error: null };
    responsesCreate.mockResolvedValue({ output_text: "I don't know.", status: "completed" });

    const res = await post(validBody);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ reply: "I don't know." });
    expect(responsesCreate).toHaveBeenCalledOnce();
  });

  it("continues a conversation of this project", async () => {
    rpcs.save_chat_turn = { data: CONVERSATION_ID, error: null };

    const res = await post({ ...validBody, conversationId: CONVERSATION_ID });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ conversationId: CONVERSATION_ID });
    expect(eq).toHaveBeenCalledWith("conversations", "id", CONVERSATION_ID);
    expect(eq).toHaveBeenCalledWith("conversations", "project_id", PROJECT_ID);
    expect(rpc).toHaveBeenCalledWith("save_chat_turn", expect.objectContaining({ conversation_id: CONVERSATION_ID }));
  });

  it.each([
    ["not JSON", "{"],
    ["no message", { key: KEY, visitorId: "visitor_12345678" }],
    ["an empty message", { ...validBody, message: "   " }],
    ["a message over 1,000 characters", { ...validBody, message: "a".repeat(1001) }],
    ["a bad key", { ...validBody, key: "sk_nope" }],
    ["a bad visitor id", { ...validBody, visitorId: "x" }],
    ["a bad conversation id", { ...validBody, conversationId: "not-a-uuid" }],
  ])("returns 400 invalid_request for %s, before anything else", async (_label, body) => {
    const res = await post(body);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "invalid_request" } });
    expectCors(res);
    expect(from).not.toHaveBeenCalled();
    expect(protectChat).not.toHaveBeenCalled();
    expectNothingCounted();
    expectNoAi();
  });

  it("returns 404 for an unknown key, counting nothing", async () => {
    tables.projects = { data: null, error: null };

    const res = await post(validBody);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "not_found" } });
    expectCors(res);
    expectNothingCounted();
    expectNoAi();
  });

  it("passes the key and message to Arcjet", async () => {
    await post(validBody);

    expect(protectChat).toHaveBeenCalledWith(expect.any(Request), {
      key: KEY,
      message: "When are you open?",
      project: { id: PROJECT_ID, ownerId: OWNER_ID, plan: "free" },
    });
  });

  it.each([
    ["rate_limit", 429, "rate_limited"],
    ["prompt_injection", 403, "forbidden"],
    ["bot", 403, "forbidden"],
    ["shield", 403, "forbidden"],
  ] as const)("blocked by Arcjet (%s) → %i %s, counting nothing", async (reason, status, code) => {
    protectChat.mockResolvedValue({ allowed: false, reason });

    const res = await post(validBody);

    expect(res.status).toBe(status);
    await expect(res.json()).resolves.toMatchObject({ error: { code } });
    expectCors(res);
    expectNothingCounted();
    expectNoAi();
    expect(rpcNames()).not.toContain("save_chat_turn");
  });

  it("returns 404 for a conversation of another project, counting nothing", async () => {
    tables.conversations = { data: null, error: null };

    const res = await post({ ...validBody, conversationId: CONVERSATION_ID });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "not_found" } });
    expectCors(res);
    expectNothingCounted();
    expectNoAi();
  });

  it("returns 429 quota_exceeded at the monthly limit, without an AI call", async () => {
    rpcs.consume_message = { data: false, error: null };

    const res = await post(validBody);

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "quota_exceeded" } });
    expectCors(res);
    expectNoAi();
    expect(rpcNames()).toEqual(["consume_message"]);
  });

  it("keeps the message counted when the model fails, with a friendly 500", async () => {
    responsesCreate.mockRejectedValue(new Error("model overloaded: secret detail"));

    const res = await post(validBody);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ error: { code: "internal_error" } });
    expect(body.error.message).toMatch(/couldn't answer/);
    expect(JSON.stringify(body)).not.toContain("secret");
    expectCors(res);
    expect(rpcNames()).toEqual(["consume_message", "match_chunks"]);
  });

  it("treats an empty model reply as a model error", async () => {
    responsesCreate.mockResolvedValue({ output_text: "  ", status: "incomplete" });

    const res = await post(validBody);

    expect(res.status).toBe(500);
    expect(rpcNames()).not.toContain("save_chat_turn");
  });

  it("keeps the message counted when embedding fails", async () => {
    embeddingsCreate.mockRejectedValue(new Error("embeddings down"));

    const res = await post(validBody);

    expect(res.status).toBe(500);
    expect(rpcNames()).toEqual(["consume_message"]);
    expect(responsesCreate).not.toHaveBeenCalled();
  });

  it("returns 500 without details on a database error", async () => {
    tables.projects = { data: null, error: { message: "secret detail" } };

    const res = await post(validBody);

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
    expectCors(res);
    expectNothingCounted();
  });
});

describe("OPTIONS /api/widget/chat", () => {
  it("answers the preflight for any origin", () => {
    const res = OPTIONS();

    expect(res.status).toBe(204);
    expectCors(res);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });
});

describe("POST /api/widget/chat: analytics", () => {
  const TEXT = ["When are you open?", "open 9 to 5", "We are open 9 to 5"];
  const expectNoText = () => {
    const sent = JSON.stringify(captureImmediate.mock.calls);
    for (const text of TEXT) expect(sent).not.toContain(text);
  };

  it("sends the reply's AI trace after the response, grouped under the conversation, with no text", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(captureImmediate).not.toHaveBeenCalled(); // Nothing before the response.

    await runAfter();

    const [generation] = captured("$ai_generation");
    expect(captured("$ai_generation")).toHaveLength(1);
    expect(generation).toEqual({
      event: "$ai_generation",
      distinctId: "visitor_12345678",
      properties: expect.objectContaining({
        $ai_trace_id: NEW_CONVERSATION_ID,
        $ai_session_id: NEW_CONVERSATION_ID,
        $ai_provider: "openai",
        $ai_model: "gpt-6-luna-2026-10-01",
        $ai_input_tokens: 812,
        $ai_output_tokens: 14,
        $ai_latency: expect.any(Number),
        project_id: PROJECT_ID,
        $process_person_profile: false,
      }),
    });
    const properties = (generation as unknown as { properties: Record<string, unknown> }).properties;
    expect(properties).not.toHaveProperty("$ai_input");
    expect(properties).not.toHaveProperty("$ai_output_choices");
    expectNoText();
  });

  it("traces a continued conversation under the same conversation id", async () => {
    rpcs.save_chat_turn = { data: CONVERSATION_ID, error: null };
    await post({ ...validBody, conversationId: CONVERSATION_ID });
    await runAfter();

    expect(captured("$ai_generation")[0]).toMatchObject({ properties: { $ai_trace_id: CONVERSATION_ID } });
  });

  it("sends first_chat once, for the owner, when the new conversation is the project's first", async () => {
    tables.conversations = { data: { id: NEW_CONVERSATION_ID }, error: null };

    await post(validBody);
    await runAfter();

    expect(captured("first_chat")).toEqual([
      {
        event: "first_chat",
        distinctId: OWNER_ID,
        properties: { project_id: PROJECT_ID, conversation_id: NEW_CONVERSATION_ID },
      },
    ]);
    expect(eq).toHaveBeenCalledWith("conversations", "project_id", PROJECT_ID);
    expectNoText();
  });

  it("sends no first_chat for a later conversation or a continued one", async () => {
    // The project's earliest conversation is an older one.
    tables.conversations = { data: { id: CONVERSATION_ID }, error: null };
    await post(validBody);
    rpcs.save_chat_turn = { data: CONVERSATION_ID, error: null };
    await post({ ...validBody, conversationId: CONVERSATION_ID });
    await runAfter();

    expect(captured("first_chat")).toHaveLength(0);
    expect(captured("$ai_generation")).toHaveLength(2);
  });

  it("sends nothing when the model fails or the turn is refused", async () => {
    responsesCreate.mockRejectedValue(new Error("model down"));
    await post(validBody);
    rpcs.consume_message = { data: false, error: null };
    await post(validBody);
    await runAfter();

    expect(captureImmediate).not.toHaveBeenCalled();
  });

  it("a PostHog failure never fails the reply", async () => {
    tables.conversations = { data: { id: NEW_CONVERSATION_ID }, error: null };
    captureImmediate.mockRejectedValue(new Error("posthog down"));

    const res = await post(validBody);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ conversationId: NEW_CONVERSATION_ID });
    await expect(runAfter()).resolves.toBeUndefined();
  });

  it("a failing first-chat lookup never fails the reply", async () => {
    tables.conversations = { data: null, error: { message: "boom" } };

    const res = await post(validBody);

    expect(res.status).toBe(200);
    await expect(runAfter()).resolves.toBeUndefined();
    expect(captured("first_chat")).toHaveLength(0);
    expect(captured("$ai_generation")).toHaveLength(1);
  });
});
