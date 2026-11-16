import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLoadedPostHog } = vi.hoisted(() => ({ getLoadedPostHog: vi.fn() }));
vi.mock("@/lib/analytics/client", () => ({ getLoadedPostHog }));

const { trackSnippetCopied } = await import("./track-snippet-copied");

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const capture = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getLoadedPostHog.mockReturnValue({ capture });
});

describe("trackSnippetCopied", () => {
  it("sends snippet_copied once with the project ID only", () => {
    trackSnippetCopied(PROJECT_ID);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith("snippet_copied", { project_id: PROJECT_ID });
  });

  it("does nothing when PostHog isn't loaded", () => {
    getLoadedPostHog.mockReturnValue(null);
    expect(() => trackSnippetCopied(PROJECT_ID)).not.toThrow();
  });

  it("never throws when PostHog does", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    capture.mockImplementation(() => {
      throw new Error("posthog down");
    });
    expect(() => trackSnippetCopied(PROJECT_ID)).not.toThrow();
  });
});
