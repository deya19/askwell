import { DEFAULT_WIDGET_CONFIG, type Plan } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let signedIn = true;
vi.mock("../../../../../lib/auth/require-owner", async () => {
  const { unauthorizedResponse } = await import("../../../../../lib/auth/unauthorized");
  return {
    requireOwner: vi.fn(async () =>
      signedIn ? { ok: true, userId: "user_owner" } : { ok: false, response: unauthorizedResponse() },
    ),
  };
});

const ID = "6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f";

// RLS: another owner's project comes back as null.
let ownedProject: { id: string } | null = { id: ID };
const getOwnedProject = vi.fn<(id: string) => Promise<{ id: string } | null>>(async () => ownedProject);
vi.mock("../../../../../lib/supabase/owned-project", () => ({ getOwnedProject }));

let plan: Plan | null = "pro";
const getOwnerPlan = vi.fn<(client: unknown, userId: string) => Promise<Plan | null>>(async () => plan);
vi.mock("../../../../../lib/projects/plan", () => ({ getOwnerPlan }));

const savedRow = {
  project_id: ID,
  button_color: "#0a0a0a",
  position: "bottom-right",
  label: "Ask a question",
  animation: "fade",
  header_text: "How can we help?",
  show_badge: false,
};

// Owner client: reads the saved `widget_configs` row.
let readResult: { data: typeof savedRow | null; error: { message: string } | null } = { data: savedRow, error: null };
const readQuery = {
  select: vi.fn(() => readQuery),
  eq: vi.fn(() => readQuery),
  maybeSingle: vi.fn(async () => readResult),
};
const ownerFrom = vi.fn<(table: string) => typeof readQuery>(() => readQuery);
const createOwnerClient = vi.fn(async () => ({ from: ownerFrom }));
vi.mock("../../../../../lib/supabase/owner", () => ({ createOwnerClient }));

// Service client: the upsert echoes the row it was given.
let writeError: { message: string } | null = null;
let written: Record<string, unknown> | null = null;
const writeQuery = {
  select: vi.fn(() => writeQuery),
  single: vi.fn(async () => (writeError ? { data: null, error: writeError } : { data: written, error: null })),
};
const upsert = vi.fn<(row: Record<string, unknown>, options: unknown) => typeof writeQuery>((row) => {
  written = row;
  return writeQuery;
});
const serviceFrom = vi.fn<(table: string) => { upsert: typeof upsert }>(() => ({ upsert }));
const createServiceClient = vi.fn(() => ({ from: serviceFrom }));
vi.mock("../../../../../lib/supabase/service", () => ({ createServiceClient }));

const { PATCH } = await import("./route");

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patch(body: unknown): Request {
  return new Request(`http://localhost/api/projects/${ID}/config`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function errorCode(res: Response): Promise<string> {
  const json = (await res.json()) as { error: { code: string } };
  return json.error.code;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  signedIn = true;
  ownedProject = { id: ID };
  plan = "pro";
  readResult = { data: savedRow, error: null };
  writeError = null;
  written = null;
});

describe("PATCH /api/projects/:id/config", () => {
  it("returns 401 when signed out, and reads nothing", async () => {
    signedIn = false;
    const res = await PATCH(patch({ buttonColor: "#ff0000" }), context(ID));
    expect(res.status).toBe(401);
    expect(getOwnedProject).not.toHaveBeenCalled();
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 404 for another owner's project, and writes nothing", async () => {
    ownedProject = null;
    const res = await PATCH(patch({ buttonColor: "#ff0000" }), context(ID));
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
    expect(getOwnerPlan).not.toHaveBeenCalled();
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 404 for an id that isn't a UUID", async () => {
    const res = await PATCH(patch({ buttonColor: "#ff0000" }), context("nope"));
    expect(res.status).toBe(404);
    expect(getOwnedProject).not.toHaveBeenCalled();
  });

  it("returns 402 on Free, and writes nothing", async () => {
    plan = "free";
    const res = await PATCH(patch({ buttonColor: "#ff0000" }), context(ID));
    expect(res.status).toBe(402);
    expect(await errorCode(res)).toBe("plan_required");
    expect(getOwnerPlan).toHaveBeenCalledWith(expect.anything(), "user_owner");
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 402 when the account row is missing", async () => {
    plan = null;
    const res = await PATCH(patch({ buttonColor: "#ff0000" }), context(ID));
    expect(res.status).toBe(402);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 402 on Free even for an invalid body", async () => {
    plan = "free";
    const res = await PATCH(patch({ buttonColor: "red" }), context(ID));
    expect(res.status).toBe(402);
  });

  it("merges a partial body into the saved config on Pro and returns it", async () => {
    readResult = { data: { ...savedRow, position: "top-left", label: "Help" }, error: null };

    const res = await PATCH(patch({ buttonColor: "#FF0000", headerText: "  Hi there  " }), context(ID));

    expect(res.status).toBe(200);
    const expected = {
      buttonColor: "#FF0000",
      position: "top-left",
      label: "Help",
      animation: "fade",
      headerText: "Hi there",
      showBadge: false,
    };
    await expect(res.json()).resolves.toEqual({ config: expected });
    expect(ownerFrom).toHaveBeenCalledWith("widget_configs");
    expect(readQuery.eq).toHaveBeenCalledWith("project_id", ID);
    expect(serviceFrom).toHaveBeenCalledWith("widget_configs");
    expect(upsert).toHaveBeenCalledWith(
      {
        project_id: ID,
        button_color: "#FF0000",
        position: "top-left",
        label: "Help",
        animation: "fade",
        header_text: "Hi there",
        show_badge: false,
      },
      { onConflict: "project_id" },
    );
  });

  it("starts from the defaults when the config row is missing", async () => {
    readResult = { data: null, error: null };
    const res = await PATCH(patch({ showBadge: true }), context(ID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ config: { ...DEFAULT_WIDGET_CONFIG, showBadge: true } });
  });

  it.each([
    ["an empty object", {}],
    ["an unknown field", { buttonColor: "#ff0000", owner_id: "user_other" }],
    ["a bad color", { buttonColor: "red" }],
    ["a bad position", { position: "middle" }],
    ["a blank label", { label: "   " }],
    ["a label that's too long", { label: "x".repeat(41) }],
    ["a non-boolean badge", { showBadge: "no" }],
    ["an array", [{ buttonColor: "#ff0000" }]],
    ["null", null],
  ])("returns 400 for %s, and writes nothing", async (_name, body) => {
    const res = await PATCH(patch(body), context(ID));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("invalid_request");
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that isn't JSON", async () => {
    const res = await PATCH(patch("{not json"), context(ID));
    expect(res.status).toBe(400);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 500 without details when the read fails", async () => {
    readResult = { data: null, error: { message: "db down" } };
    const res = await PATCH(patch({ buttonColor: "#ff0000" }), context(ID));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("db down");
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 500 when the write fails", async () => {
    writeError = { message: "check violation" };
    const res = await PATCH(patch({ buttonColor: "#ff0000" }), context(ID));
    expect(res.status).toBe(500);
  });

  it("returns 500 when the plan can't be read", async () => {
    getOwnerPlan.mockRejectedValueOnce(new Error("Could not load plan"));
    const res = await PATCH(patch({ buttonColor: "#ff0000" }), context(ID));
    expect(res.status).toBe(500);
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});
