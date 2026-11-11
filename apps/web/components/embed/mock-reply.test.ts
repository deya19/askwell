import { APP_NAME } from "@askwell/shared";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MOCK_REPLY, MOCK_REPLY_DELAY_MS, requestReply } from "./mock-reply";

const request = { key: "pk_test_abcdefgh", visitorId: "v_12345678", message: "What are your hours?" };

afterEach(() => {
  vi.useRealTimers();
});

describe("requestReply (mock)", () => {
  test("says it's a preview and names the app", () => {
    expect(MOCK_REPLY).toContain(APP_NAME);
    expect(MOCK_REPLY.toLowerCase()).toContain("preview");
  });

  test("resolves with the fixed reply after about a second", async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    void requestReply(request).then(done);
    await vi.advanceTimersByTimeAsync(MOCK_REPLY_DELAY_MS - 1);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalledWith({ reply: MOCK_REPLY });
    expect(MOCK_REPLY_DELAY_MS).toBeGreaterThanOrEqual(800);
    expect(MOCK_REPLY_DELAY_MS).toBeLessThanOrEqual(1500);
  });

  test("the same reply whatever the message", async () => {
    const html = { ...request, message: "<img src=x onerror=alert(1)>" };
    await expect(requestReply(html, { delayMs: 0 })).resolves.toEqual({ reply: MOCK_REPLY });
  });

  test("abort rejects and cancels the timer", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = requestReply(request, { signal: controller.signal });
    controller.abort(new Error("unmounted"));
    await expect(pending).rejects.toThrow("unmounted");
    expect(vi.getTimerCount()).toBe(0);
  });

  test("an already-aborted signal rejects at once", async () => {
    const controller = new AbortController();
    controller.abort(new Error("gone"));
    await expect(requestReply(request, { signal: controller.signal })).rejects.toThrow("gone");
  });
});
