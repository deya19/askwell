import { describe, expect, test } from "vitest";
import { MAX_CHAT_MESSAGE_LENGTH, MAX_KNOWLEDGE_FILE_BYTES } from "../limits";
import { API_ERROR_STATUS, apiError, apiErrorSchema } from "./errors";
import { idParamsSchema } from "./common";
import { chatRequestSchema, chatResponseSchema, widgetConfigQuerySchema, widgetConfigResponseSchema } from "./widget";
import {
  createProjectRequestSchema,
  projectResponseSchema,
  updateProjectRequestSchema,
  updateWidgetConfigRequestSchema,
} from "./projects";
import {
  createTextSourceRequestSchema,
  createUploadUrlRequestSchema,
  createUploadUrlResponseSchema,
  finalizeUploadRequestSchema,
} from "./knowledge";
import { conversationResponseSchema, listConversationsResponseSchema } from "./conversations";
import { clerkSubscriptionItemEventSchema, posthogConfigResponseSchema } from "./system";
import { DEFAULT_WIDGET_CONFIG } from "../widget-config";

const ID = "3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b";
const KEY = "pk_a1B2c3D4e5F6g7H8";
const NOW = "2026-11-09T12:00:00.000Z";

describe("errors", () => {
  test("apiError builds the { error: { code, message } } body", () => {
    const body = apiError("not_found", "Project not found");
    expect(body).toEqual({ error: { code: "not_found", message: "Project not found" } });
    expect(apiErrorSchema.parse(body)).toEqual(body);
  });

  test("statuses match the spec", () => {
    expect(API_ERROR_STATUS.plan_required).toBe(402);
    expect(API_ERROR_STATUS.not_found).toBe(404);
    expect(API_ERROR_STATUS.rate_limited).toBe(429);
  });

  test("rejects an unknown code", () => {
    expect(apiErrorSchema.safeParse({ error: { code: "oops", message: "x" } }).success).toBe(false);
  });
});

describe("common", () => {
  test("id params must be a uuid", () => {
    expect(idParamsSchema.safeParse({ id: ID }).success).toBe(true);
    expect(idParamsSchema.safeParse({ id: "1" }).success).toBe(false);
  });
});

describe("GET /api/widget/config", () => {
  test("accepts a public key", () => {
    expect(widgetConfigQuerySchema.parse({ key: KEY })).toEqual({ key: KEY });
  });

  test.each(["", "sk_a1B2c3D4e5F6", "pk_", "pk_short", "pk_has spaces in it"])("rejects key %j", (key) => {
    expect(widgetConfigQuerySchema.safeParse({ key }).success).toBe(false);
  });

  test("response wraps a valid config", () => {
    expect(widgetConfigResponseSchema.safeParse({ config: DEFAULT_WIDGET_CONFIG }).success).toBe(true);
    expect(widgetConfigResponseSchema.safeParse({ config: {} }).success).toBe(false);
  });
});

describe("POST /api/widget/chat", () => {
  const valid = { key: KEY, visitorId: "v_12345678", message: "What are your hours?" };

  test("accepts a first message without a conversation", () => {
    expect(chatRequestSchema.parse(valid)).toEqual(valid);
  });

  test("accepts a follow-up with a conversation id and trims the message", () => {
    expect(chatRequestSchema.parse({ ...valid, conversationId: ID, message: "  hi  " })).toMatchObject({
      conversationId: ID,
      message: "hi",
    });
  });

  test("accepts a message at the length limit", () => {
    expect(chatRequestSchema.safeParse({ ...valid, message: "x".repeat(MAX_CHAT_MESSAGE_LENGTH) }).success).toBe(true);
  });

  test.each([
    ["an over-long message", { message: "x".repeat(MAX_CHAT_MESSAGE_LENGTH + 1) }],
    ["a blank message", { message: "   " }],
    ["a bad conversation id", { conversationId: "abc" }],
    ["a bad visitor id", { visitorId: "<script>" }],
    ["a missing key", { key: undefined }],
  ])("rejects %s", (_, patch) => {
    expect(chatRequestSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  test("response has a conversation id and a reply", () => {
    expect(chatResponseSchema.safeParse({ conversationId: ID, reply: "We open at 9." }).success).toBe(true);
    expect(chatResponseSchema.safeParse({ reply: "We open at 9." }).success).toBe(false);
  });
});

describe("projects", () => {
  test("create and rename take a trimmed name", () => {
    expect(createProjectRequestSchema.parse({ name: "  My site " })).toEqual({ name: "My site" });
    expect(updateProjectRequestSchema.parse({ name: "Renamed" })).toEqual({ name: "Renamed" });
  });

  test.each([{ name: "" }, { name: "   " }, { name: "x".repeat(81) }, {}])("rejects %j", (body) => {
    expect(createProjectRequestSchema.safeParse(body).success).toBe(false);
  });

  test("response shape", () => {
    const project = { id: ID, name: "Site", publicKey: KEY, messagesUsed: 0, periodStart: NOW, createdAt: NOW };
    expect(projectResponseSchema.safeParse({ project }).success).toBe(true);
    expect(projectResponseSchema.safeParse({ project: { ...project, messagesUsed: -1 } }).success).toBe(false);
  });
});

describe("PATCH /api/projects/:id/config", () => {
  test("accepts a partial update", () => {
    expect(updateWidgetConfigRequestSchema.parse({ buttonColor: "#123abc" })).toEqual({ buttonColor: "#123abc" });
  });

  test.each([
    ["an empty body", {}],
    ["an unknown field", { color: "#123abc" }],
    ["a bad value", { position: "middle" }],
  ])("rejects %s", (_, body) => {
    expect(updateWidgetConfigRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe("knowledge", () => {
  test("pasted text needs a title and content", () => {
    expect(createTextSourceRequestSchema.safeParse({ title: "FAQ", content: "Q: A" }).success).toBe(true);
    expect(createTextSourceRequestSchema.safeParse({ title: "FAQ", content: " " }).success).toBe(false);
    expect(createTextSourceRequestSchema.safeParse({ content: "Q: A" }).success).toBe(false);
  });

  test("upload-url accepts an allowed file within the size limit", () => {
    expect(createUploadUrlRequestSchema.safeParse({ fileName: "guide.pdf", size: 1024 }).success).toBe(true);
    expect(
      createUploadUrlRequestSchema.safeParse({ fileName: "notes.md", size: MAX_KNOWLEDGE_FILE_BYTES, title: "Notes" })
        .success,
    ).toBe(true);
  });

  test.each([
    ["a disallowed type", { fileName: "report.docx", size: 1024 }],
    ["an oversized file", { fileName: "guide.pdf", size: MAX_KNOWLEDGE_FILE_BYTES + 1 }],
    ["an empty file", { fileName: "guide.pdf", size: 0 }],
    ["a fractional size", { fileName: "guide.pdf", size: 1.5 }],
  ])("upload-url rejects %s", (_, body) => {
    expect(createUploadUrlRequestSchema.safeParse(body).success).toBe(false);
  });

  test("upload-url response carries the source and the signed upload", () => {
    const source = { id: ID, projectId: ID, title: "Guide", type: "pdf", status: "uploading", createdAt: NOW };
    const upload = { path: `${ID}/${ID}.pdf`, token: "t", signedUrl: "https://example.supabase.co/x?token=t" };
    expect(createUploadUrlResponseSchema.safeParse({ source, upload }).success).toBe(true);
    expect(createUploadUrlResponseSchema.safeParse({ source: { ...source, status: "done" }, upload }).success).toBe(
      false,
    );
  });

  test("finalize takes a source id", () => {
    expect(finalizeUploadRequestSchema.safeParse({ sourceId: ID }).success).toBe(true);
    expect(finalizeUploadRequestSchema.safeParse({ sourceId: "x" }).success).toBe(false);
  });
});

describe("conversations", () => {
  test("list response", () => {
    const row = { id: ID, visitorId: "v_12345678", preview: "Hi", messageCount: 2, createdAt: NOW };
    expect(listConversationsResponseSchema.safeParse({ conversations: [row] }).success).toBe(true);
    expect(listConversationsResponseSchema.safeParse({ conversations: [{ ...row, messageCount: "2" }] }).success).toBe(
      false,
    );
  });

  test("thread response", () => {
    const conversation = { id: ID, projectId: ID, visitorId: "v_12345678", createdAt: NOW };
    const messages = [
      { id: ID, role: "visitor", body: "Hi", createdAt: NOW },
      { id: ID, role: "bot", body: "Hello!", createdAt: NOW },
    ];
    expect(conversationResponseSchema.safeParse({ conversation, messages }).success).toBe(true);
    expect(
      conversationResponseSchema.safeParse({ conversation, messages: [{ ...messages[0], role: "assistant" }] }).success,
    ).toBe(false);
  });
});

describe("system", () => {
  test("Clerk subscription item event: reads payer and plan, keeps other fields", () => {
    const event = {
      type: "subscriptionItem.active",
      object: "event",
      data: { id: "csubi_1", status: "active", payer: { user_id: "user_1", email: "a@b.c" }, plan: { slug: "pro" } },
    };
    const parsed = clerkSubscriptionItemEventSchema.parse(event);
    expect(parsed.data.payer.user_id).toBe("user_1");
    expect(parsed.data.plan?.slug).toBe("pro");
    expect(parsed).toMatchObject({ object: "event" });
  });

  test("Clerk webhook ignores other event types", () => {
    const event = { type: "user.created", data: { id: "user_1", status: "x", payer: {} } };
    expect(clerkSubscriptionItemEventSchema.safeParse(event).success).toBe(false);
  });

  test("PostHog config response", () => {
    expect(posthogConfigResponseSchema.safeParse({ key: "phc_x", host: "https://us.i.posthog.com" }).success).toBe(true);
    expect(posthogConfigResponseSchema.safeParse({ key: "", host: "nope" }).success).toBe(false);
  });
});
