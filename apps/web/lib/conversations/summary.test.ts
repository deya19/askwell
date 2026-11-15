import { conversationSummarySchema } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { PREVIEW_LENGTH, summarizeConversations, toPreview } from "./summary";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const AT = "2026-11-14T10:00:00.000000+00:00";

function conv(id: string) {
  return { id, visitor_id: `v_${id.slice(0, 4)}`, created_at: AT };
}
function msg(conversation_id: string, role: string, body: string) {
  return { conversation_id, role, body, created_at: AT };
}

describe("toPreview", () => {
  it("keeps a short message as is", () => {
    expect(toPreview("How do I reset my password?")).toBe("How do I reset my password?");
  });

  it(`cuts a long message to ${PREVIEW_LENGTH} characters`, () => {
    const preview = toPreview("a".repeat(500));
    expect(preview).toBe("a".repeat(PREVIEW_LENGTH));
  });

  it("puts the message on one line", () => {
    expect(toPreview("  Hi\n\nthere\t you  ")).toBe("Hi there you");
  });

  it("never splits an emoji", () => {
    const preview = toPreview("😀".repeat(200));
    expect(Array.from(preview)).toHaveLength(PREVIEW_LENGTH);
    expect(preview).toBe("😀".repeat(PREVIEW_LENGTH));
  });
});

describe("summarizeConversations", () => {
  it("gives a conversation with no messages an empty preview and a count of 0", () => {
    const [row] = summarizeConversations([conv(A)], []);
    expect(row).toEqual({ id: A, visitorId: "v_1111", preview: "", messageCount: 0, createdAt: AT });
    expect(conversationSummarySchema.parse(row)).toEqual(row);
  });

  it("takes the preview from the first visitor message and counts every message", () => {
    const rows = summarizeConversations(
      [conv(A)],
      [msg(A, "bot", "Welcome!"), msg(A, "visitor", "First question"), msg(A, "bot", "Answer"), msg(A, "visitor", "Second")],
    );
    expect(rows[0]).toMatchObject({ preview: "First question", messageCount: 4 });
  });

  it("cuts the preview to length", () => {
    const rows = summarizeConversations([conv(A)], [msg(A, "visitor", "x".repeat(300))]);
    expect(rows[0]!.preview).toHaveLength(PREVIEW_LENGTH);
  });

  it("gives an empty preview when only the bot spoke", () => {
    const rows = summarizeConversations([conv(A)], [msg(A, "bot", "Hi")]);
    expect(rows[0]).toMatchObject({ preview: "", messageCount: 1 });
  });

  it("keeps each conversation's messages apart and keeps the conversations' order", () => {
    const rows = summarizeConversations(
      [conv(B), conv(A)],
      [msg(A, "visitor", "from A"), msg(B, "visitor", "from B"), msg(A, "bot", "reply A")],
    );
    expect(rows.map((r) => [r.id, r.preview, r.messageCount])).toEqual([
      [B, "from B", 1],
      [A, "from A", 2],
    ]);
  });
});
