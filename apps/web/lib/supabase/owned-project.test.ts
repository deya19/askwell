import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnedProject } from "./owned-project";

vi.mock("server-only", () => ({}));

type Result = { data: OwnedProject | null; error: { message: string } | null };
let result: Result = { data: null, error: null };

const query = {
  select: vi.fn(() => query),
  eq: vi.fn(() => query),
  maybeSingle: vi.fn(async () => result),
};
const from = vi.fn(() => query);
const createOwnerClient = vi.fn(async () => ({ from }));
const createServiceClient = vi.fn();

vi.mock("./owner", () => ({ createOwnerClient }));
vi.mock("./service", () => ({ createServiceClient }));

const { getOwnedProject } = await import("./owned-project");

const PROJECT_ID = "6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f";
const project: OwnedProject = {
  id: PROJECT_ID,
  owner_id: "user_owner",
  name: "Docs site",
  public_key: "pk_test",
  messages_used: 0,
  period_start: "2026-11-01T00:00:00Z",
  created_at: "2026-11-01T00:00:00Z",
};

describe("getOwnedProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    result = { data: null, error: null };
  });

  it("returns the project when the owner client can see it", async () => {
    result = { data: project, error: null };
    await expect(getOwnedProject(PROJECT_ID)).resolves.toEqual(project);
    expect(from).toHaveBeenCalledWith("projects");
    expect(query.eq).toHaveBeenCalledWith("id", PROJECT_ID);
  });

  it("returns null for a project the owner client can't see", async () => {
    result = { data: null, error: null };
    await expect(getOwnedProject(PROJECT_ID)).resolves.toBeNull();
  });

  it("filters by id only and relies on RLS, never the service client", async () => {
    await getOwnedProject(PROJECT_ID);
    expect(createOwnerClient).toHaveBeenCalledOnce();
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledOnce();
  });

  it("returns null for an id that isn't a UUID, without a query", async () => {
    await expect(getOwnedProject("not-a-uuid")).resolves.toBeNull();
    expect(createOwnerClient).not.toHaveBeenCalled();
  });

  it("throws on a database error instead of returning null", async () => {
    result = { data: null, error: { message: "boom" } };
    await expect(getOwnedProject(PROJECT_ID)).rejects.toThrow("Could not load project: boom");
  });
});
