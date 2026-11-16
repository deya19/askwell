import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { after } = vi.hoisted(() => ({ after: vi.fn() }));
vi.mock("next/server", () => ({ after }));
vi.mock("../analytics/server", () => ({ captureAiEvent: vi.fn(), captureServerEvent: vi.fn() }));

const { generationProperties, inBackground } = await import("./analytics");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("inBackground", () => {
  it("runs the task after the response, and logs instead of throwing when it fails", async () => {
    const task = vi.fn(async () => {
      throw new Error("posthog down");
    });

    inBackground("test", task);
    expect(task).not.toHaveBeenCalled();

    const [run] = after.mock.calls[0] as [() => Promise<void>];
    await expect(run()).resolves.toBeUndefined();
    expect(task).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith("[analytics] test failed", expect.any(Error));
  });

  it("never throws when after() itself does (e.g. outside a request)", () => {
    after.mockImplementation(() => {
      throw new Error("outside a request scope");
    });
    expect(() => inBackground("test", vi.fn(async () => {}))).not.toThrow();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("generationProperties", () => {
  it("groups the generation under the conversation, personless, with no text properties", () => {
    const properties = generationProperties(
      { model: "gpt-6-luna", inputTokens: 100, outputTokens: 20, latency: 1.25, maxOutputTokens: 500 },
      { projectId: "p1", conversationId: "c1" },
    );

    expect(properties).toMatchObject({
      $ai_trace_id: "c1",
      $ai_session_id: "c1",
      $ai_provider: "openai",
      $ai_model: "gpt-6-luna",
      $ai_input_tokens: 100,
      $ai_output_tokens: 20,
      $ai_latency: 1.25,
      project_id: "p1",
      $process_person_profile: false,
    });
    expect(properties).not.toHaveProperty("$ai_input");
    expect(properties).not.toHaveProperty("$ai_output_choices");
  });
});
