import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDecision } from "./test-helpers";

vi.mock("server-only", () => ({}));

const protect = vi.fn();
const client = { protect, withRule: vi.fn(() => client) };
const fixedWindow = vi.fn((options: unknown) => [{ name: "fixedWindow", options }]);
vi.mock("@arcjet/next", () => ({
  default: vi.fn(() => client),
  shield: vi.fn(() => []),
  fixedWindow,
}));

const savedKey = process.env.ARCJET_KEY;
afterAll(() => {
  process.env.ARCJET_KEY = savedKey;
});

const { CONFIG_RATE_LIMIT_PER_MINUTE, protectWidgetConfig } = await import("./config");

const request = new Request("http://localhost/api/widget/config?key=pk_x");

beforeEach(() => {
  protect.mockReset();
  process.env.ARCJET_KEY = "ajkey_test";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("protectWidgetConfig", () => {
  // Runs first: the client is built once, on the first check.
  it("limits per client IP, looser than chat", async () => {
    protect.mockResolvedValue(fakeDecision("ALLOW"));
    await protectWidgetConfig(request);

    expect(fixedWindow).toHaveBeenCalledWith({
      mode: "LIVE",
      characteristics: ["ip.src"],
      window: 60,
      max: CONFIG_RATE_LIMIT_PER_MINUTE,
    });
    expect(CONFIG_RATE_LIMIT_PER_MINUTE).toBe(60);
  });

  it("allows a request under the limit", async () => {
    protect.mockResolvedValue(fakeDecision("ALLOW"));

    await expect(protectWidgetConfig(request)).resolves.toEqual({ allowed: true });
    expect(protect).toHaveBeenCalledWith(request);
  });

  it("blocks with rate_limit past the limit", async () => {
    protect.mockResolvedValue(fakeDecision({ deny: "rate_limit" }));

    await expect(protectWidgetConfig(request)).resolves.toEqual({ allowed: false, reason: "rate_limit" });
  });

  it("fails open when Arcjet errors", async () => {
    protect.mockResolvedValue(fakeDecision("ERROR"));

    await expect(protectWidgetConfig(request)).resolves.toEqual({ allowed: true });
  });
});
