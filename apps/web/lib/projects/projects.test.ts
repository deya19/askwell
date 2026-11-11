import { projectSchema } from "@askwell/shared";
import { describe, expect, it, vi } from "vitest";
import type { OwnerClient } from "../supabase/owner";
import { invalidBodyMessage, readJson } from "./http";
import { getOwnerPlan } from "./plan";
import { toProject } from "./project";

vi.mock("server-only", () => ({}));

describe("toProject", () => {
  it("maps a row to a valid Project and drops owner_id", () => {
    const project = toProject({
      id: "6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f",
      owner_id: "user_owner",
      name: "Docs site",
      public_key: "pk_0123456789abcdef0123456789abcdef",
      messages_used: 7,
      period_start: "2026-11-01T00:00:00+00:00",
      created_at: "2026-11-02T10:30:00.123456+00:00",
    });

    expect(projectSchema.parse(project)).toEqual(project);
    expect(project).toEqual({
      id: "6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f",
      name: "Docs site",
      publicKey: "pk_0123456789abcdef0123456789abcdef",
      messagesUsed: 7,
      periodStart: "2026-11-01T00:00:00+00:00",
      createdAt: "2026-11-02T10:30:00.123456+00:00",
    });
    expect(project).not.toHaveProperty("owner_id");
  });
});

function ownerClient(result: { data: { plan: string } | null; error: { message: string } | null }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
  };
  const from = vi.fn(() => query);
  return { client: { from } as unknown as OwnerClient, from, query };
}

describe("getOwnerPlan", () => {
  it("returns the plan from the caller's accounts row", async () => {
    const { client, from, query } = ownerClient({ data: { plan: "pro" }, error: null });

    await expect(getOwnerPlan(client, "user_owner")).resolves.toBe("pro");
    expect(from).toHaveBeenCalledWith("accounts");
    expect(query.eq).toHaveBeenCalledWith("clerk_user_id", "user_owner");
  });

  it("returns null when there's no account row yet", async () => {
    const { client } = ownerClient({ data: null, error: null });
    await expect(getOwnerPlan(client, "user_owner")).resolves.toBeNull();
  });

  it("throws on a database error", async () => {
    const { client } = ownerClient({ data: null, error: { message: "boom" } });
    await expect(getOwnerPlan(client, "user_owner")).rejects.toThrow("Could not load plan: boom");
  });

  it("throws on a plan it doesn't know", async () => {
    const { client } = ownerClient({ data: { plan: "enterprise" }, error: null });
    await expect(getOwnerPlan(client, "user_owner")).rejects.toThrow("Unknown plan");
  });
});

describe("readJson", () => {
  it("parses a JSON body", async () => {
    const req = new Request("http://localhost", { method: "POST", body: '{"name":"x"}' });
    await expect(readJson(req)).resolves.toEqual({ name: "x" });
  });

  it("returns undefined for a body that isn't JSON", async () => {
    const req = new Request("http://localhost", { method: "POST", body: "{nope" });
    await expect(readJson(req)).resolves.toBeUndefined();
  });
});

describe("invalidBodyMessage", () => {
  it("names the first bad field", () => {
    expect(invalidBodyMessage([{ path: ["name"], message: "Too small" }])).toBe("name: Too small");
  });

  it("falls back to the message or a default", () => {
    expect(invalidBodyMessage([{ path: [], message: "Expected object" }])).toBe("Expected object");
    expect(invalidBodyMessage([])).toBe("Invalid request body.");
  });
});
