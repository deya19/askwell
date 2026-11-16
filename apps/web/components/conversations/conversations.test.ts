import { describe, expect, it } from "vitest";
import { CONVERSATION_LIST_LIMIT } from "../../lib/conversations/summary";
import {
  LIST_LIMIT_NOTE,
  conversationPath,
  conversationsPath,
  fullTimeLabel,
  listLimitNote,
  messageCountLabel,
  timeLabel,
  toConversationRows,
} from "./copy";

const NOW = Date.parse("2026-11-16T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("timeLabel", () => {
  it("says Just now under a minute", () => {
    expect(timeLabel(ago(0), NOW)).toBe("Just now");
    expect(timeLabel(ago(59_000), NOW)).toBe("Just now");
  });

  it("counts minutes, then hours", () => {
    expect(timeLabel(ago(60_000), NOW)).toBe("1 min ago");
    expect(timeLabel(ago(59 * 60_000), NOW)).toBe("59 min ago");
    expect(timeLabel(ago(60 * 60_000), NOW)).toBe("1 h ago");
    expect(timeLabel(ago(23 * 3_600_000 + 59 * 60_000), NOW)).toBe("23 h ago");
  });

  it("shows the date from a day on", () => {
    expect(timeLabel(ago(24 * 3_600_000), NOW)).toBe("Nov 15, 2026");
    expect(timeLabel("2026-01-02T03:04:05Z", NOW)).toBe("Jan 2, 2026");
  });

  it("treats a clock a little ahead as Just now", () => {
    expect(timeLabel(new Date(NOW + 5_000).toISOString(), NOW)).toBe("Just now");
  });
});

describe("fullTimeLabel", () => {
  it("is the UTC date and time", () => {
    expect(fullTimeLabel("2026-11-11T15:04:00Z")).toBe("Nov 11, 2026, 3:04 PM UTC");
  });
});

describe("messageCountLabel", () => {
  it("pluralizes", () => {
    expect(messageCountLabel(0)).toBe("0 messages");
    expect(messageCountLabel(1)).toBe("1 message");
    expect(messageCountLabel(1200)).toBe("1,200 messages");
  });
});

describe("listLimitNote", () => {
  it("shows only when the list is cut at the limit", () => {
    expect(CONVERSATION_LIST_LIMIT).toBe(100);
    expect(listLimitNote(0)).toBeNull();
    expect(listLimitNote(99)).toBeNull();
    expect(listLimitNote(100)).toBe("Showing the newest 100 conversations.");
    expect(LIST_LIMIT_NOTE).toBe("Showing the newest 100 conversations.");
  });
});

describe("paths", () => {
  it("builds the list and thread URLs", () => {
    expect(conversationsPath("p1")).toBe("/dashboard/projects/p1/conversations");
    expect(conversationPath("p1", "c1")).toBe("/dashboard/projects/p1/conversations/c1");
  });

  it("encodes the ids", () => {
    expect(conversationPath("a/b", "c?d")).toBe("/dashboard/projects/a%2Fb/conversations/c%3Fd");
  });
});

describe("toConversationRows", () => {
  it("keeps the order and the raw preview text", () => {
    const xss = "<img src=x onerror=alert(1)>";
    const rows = toConversationRows(
      "p1",
      [
        { id: "c2", visitorId: "v", preview: xss, messageCount: 2, createdAt: ago(5 * 60_000) },
        { id: "c1", visitorId: "v", preview: "", messageCount: 1, createdAt: ago(2 * 86_400_000) },
      ],
      NOW,
    );
    expect(rows).toEqual([
      {
        id: "c2",
        href: "/dashboard/projects/p1/conversations/c2",
        preview: xss,
        count: "2 messages",
        time: "5 min ago",
        fullTime: "Nov 16, 2026, 11:55 AM UTC",
        createdAt: ago(5 * 60_000),
      },
      {
        id: "c1",
        href: "/dashboard/projects/p1/conversations/c1",
        preview: "",
        count: "1 message",
        time: "Nov 14, 2026",
        fullTime: "Nov 14, 2026, 12:00 PM UTC",
        createdAt: ago(2 * 86_400_000),
      },
    ]);
  });
});
