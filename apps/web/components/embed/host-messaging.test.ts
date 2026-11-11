import { WIDGET_MESSAGE_SOURCE } from "@askwell/shared";
import { describe, expect, test, vi } from "vitest";
import { acceptHostMessage, postToHost, unreadOnReply, unreadOnVisibility } from "./host-messaging";

const HOST = "https://customer.example";
const parent = { postMessage: vi.fn() };
const opened = { source: WIDGET_MESSAGE_SOURCE, type: "opened" };

describe("acceptHostMessage", () => {
  test("accepts our message from the parent on host", () => {
    expect(acceptHostMessage({ origin: HOST, source: parent as never, data: opened }, HOST, parent)).toEqual(opened);
  });

  test.each([
    ["another origin", { origin: "https://evil.example", source: parent, data: opened }],
    ["host with a trailing slash", { origin: `${HOST}/`, source: parent, data: opened }],
    ["another window", { origin: HOST, source: {}, data: opened }],
    ["no source", { origin: HOST, source: null, data: opened }],
    ["a panel message", { origin: HOST, source: parent, data: { source: WIDGET_MESSAGE_SOURCE, type: "close" } }],
    ["untagged data", { origin: HOST, source: parent, data: { type: "opened" } }],
  ])("ignores %s", (_name, event) => {
    expect(acceptHostMessage(event as never, HOST, parent)).toBeNull();
  });
});

describe("postToHost", () => {
  test("posts tagged messages with host as targetOrigin", () => {
    const self = { parent: { postMessage: vi.fn() } };
    postToHost(self as never, HOST, { type: "close" });
    postToHost(self as never, HOST, { type: "unread", count: 2 });
    expect(self.parent.postMessage.mock.calls).toEqual([
      [{ source: WIDGET_MESSAGE_SOURCE, type: "close" }, HOST],
      [{ source: WIDGET_MESSAGE_SOURCE, type: "unread", count: 2 }, HOST],
    ]);
  });

  test("does nothing when the page isn't framed", () => {
    const self = { postMessage: vi.fn() } as { postMessage: ReturnType<typeof vi.fn>; parent?: unknown };
    self.parent = self;
    postToHost(self as never, HOST, { type: "close" });
    expect(self.postMessage).not.toHaveBeenCalled();
  });
});

describe("unread", () => {
  test("replies while visible don't count", () => {
    expect(unreadOnReply({ visible: true, count: 0 })).toEqual({ state: { visible: true, count: 0 }, post: null });
  });

  test("replies while hidden count up and post the count", () => {
    let state = unreadOnVisibility({ visible: true, count: 0 }, false).state;
    let step = unreadOnReply(state);
    expect(step.post).toBe(1);
    step = unreadOnReply(step.state);
    expect(step.post).toBe(2);
    state = step.state;
    const shown = unreadOnVisibility(state, true);
    expect(shown).toEqual({ state: { visible: true, count: 0 }, post: 0 });
  });

  test("showing with nothing unread posts nothing", () => {
    expect(unreadOnVisibility({ visible: false, count: 0 }, true).post).toBeNull();
  });
});
