import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@arcjet/next", () => ({ default: vi.fn(() => ({})), shield: vi.fn(() => []) }));

const savedKey = process.env.ARCJET_KEY;
afterAll(() => {
  process.env.ARCJET_KEY = savedKey;
});

describe("getArcjet", () => {
  it("throws a clear error without ARCJET_KEY, and builds nothing at import", async () => {
    delete process.env.ARCJET_KEY;
    const { getArcjet } = await import("./client");

    expect(() => getArcjet()).toThrow("ARCJET_KEY");
  });
});
