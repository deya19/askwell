import { MAX_KNOWLEDGE_FILE_BYTES, knowledgeSourceResponseSchema } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eqValue, type Query } from "../../../../../../lib/knowledge/fake-supabase";
import * as setup from "../../../../../../lib/knowledge/route-test-setup";

vi.mock("server-only", () => ({}));
vi.mock("next/server", async () => (await import("../../../../../../lib/knowledge/route-test-setup")).mocks.nextServer());
vi.mock("../../../../../../lib/auth/require-owner", async () =>
  (await import("../../../../../../lib/knowledge/route-test-setup")).mocks.requireOwner(),
);
vi.mock("../../../../../../lib/supabase/owned-project", async () =>
  (await import("../../../../../../lib/knowledge/route-test-setup")).mocks.ownedProject(),
);
vi.mock("../../../../../../lib/supabase/owner", async () =>
  (await import("../../../../../../lib/knowledge/route-test-setup")).mocks.owner(),
);
vi.mock("../../../../../../lib/supabase/service", async () =>
  (await import("../../../../../../lib/knowledge/route-test-setup")).mocks.service(),
);
vi.mock("../../../../../../lib/knowledge/process", async () =>
  (await import("../../../../../../lib/knowledge/route-test-setup")).mocks.process(),
);

const { POST, maxDuration } = await import("./route");
const { PROJECT_ID, OTHER_PROJECT_ID, SOURCE_ID, service, state } = setup;

const URL = `http://localhost/api/projects/${PROJECT_ID}/knowledge/finalize`;
const KEY = `${PROJECT_ID}/obj.pdf`;
const body = { sourceId: SOURCE_ID };
const PDF_BYTES = new TextEncoder().encode("%PDF-1.4\n...");

/** The source row in the database: `uploading` until a finalize claims it. */
let dbStatus = "uploading";
let dbType = "pdf";

function claimRow() {
  return setup.sourceRow({ type: dbType, status: "processing", storage_key: KEY });
}

beforeEach(() => {
  setup.resetState();
  dbStatus = "uploading";
  dbType = "pdf";
  state.service = (q: Query) => {
    if (q.table !== "knowledge_sources") return undefined;
    if (q.op === "update" && (q.payload as { status: string }).status === "processing") {
      // The conditional claim: only an `uploading` source in this project.
      const matches = eqValue(q, "project_id") === PROJECT_ID && eqValue(q, "id") === SOURCE_ID && dbStatus === "uploading";
      if (!matches) return { data: null, error: null };
      dbStatus = "processing";
      return { data: claimRow(), error: null };
    }
    if (q.op === "select") {
      const exists = eqValue(q, "project_id") === PROJECT_ID && eqValue(q, "id") === SOURCE_ID;
      return { data: exists ? { id: SOURCE_ID } : null, error: null };
    }
    return undefined;
  };
  service.storage.download.mockResolvedValue({ data: new Blob([PDF_BYTES]), error: null });
});

function finalize(sourceBody: unknown = body, projectId = PROJECT_ID) {
  return POST(setup.jsonPost(URL, sourceBody), setup.ctx(projectId));
}

function failedUpdate() {
  return service.queries.find((q) => q.op === "update" && (q.payload as { status: string }).status === "failed");
}

describe("POST /api/projects/:id/knowledge/finalize", () => {
  it("claims the source, checks the file, responds, then processes the bytes", async () => {
    const res = await finalize();

    expect(res.status).toBe(200);
    const json = knowledgeSourceResponseSchema.parse(await res.json());
    expect(json.source).toMatchObject({ id: SOURCE_ID, status: "processing", type: "pdf" });

    const claim = service.queries[0]!;
    expect(claim).toMatchObject({ op: "update", table: "knowledge_sources", payload: { status: "processing" } });
    expect(eqValue(claim, "status")).toBe("uploading");
    expect(eqValue(claim, "project_id")).toBe(PROJECT_ID);
    expect(service.storage.download).toHaveBeenCalledWith(KEY);

    expect(setup.processKnowledgeSource).not.toHaveBeenCalled();
    await setup.runAfter();
    expect(setup.processKnowledgeSource).toHaveBeenCalledWith(
      service.client,
      { id: SOURCE_ID, projectId: PROJECT_ID, type: "pdf" },
      { kind: "file", bytes: PDF_BYTES },
    );
  });

  it("accepts a Markdown file without the PDF check", async () => {
    dbType = "md";
    service.storage.download.mockResolvedValue({ data: new Blob(["# Hello"]), error: null });
    const res = await finalize();
    expect(res.status).toBe(200);
  });

  it("returns 409 conflict when finalized twice", async () => {
    expect((await finalize()).status).toBe(200);

    const second = await finalize();

    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({ error: { code: "conflict" } });
    expect(service.storage.download).toHaveBeenCalledTimes(1);
    expect(setup.afterCallbacks).toHaveLength(1);
  });

  it("returns 404 for a source that isn't in this project", async () => {
    const res = await finalize({ sourceId: "66666666-6666-4666-8666-666666666666" });
    expect(res.status).toBe(404);
    expect(service.storage.download).not.toHaveBeenCalled();
  });

  it("rejects a .pdf that isn't a PDF: 422, object deleted, source failed", async () => {
    service.storage.download.mockResolvedValue({ data: new Blob(["<html>not a pdf</html>"]), error: null });

    const res = await finalize();

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "file_rejected" } });
    expect(service.storage.remove).toHaveBeenCalledWith([KEY]);
    expect(eqValue(failedUpdate()!, "id")).toBe(SOURCE_ID);
    expect(setup.afterCallbacks).toHaveLength(0);
  });

  it("rejects a file over 10 MB: 422, object deleted, source failed", async () => {
    const big = new Uint8Array(MAX_KNOWLEDGE_FILE_BYTES + 1);
    big.set(PDF_BYTES);
    service.storage.download.mockResolvedValue({ data: new Blob([big]), error: null });

    const res = await finalize();

    expect(res.status).toBe(422);
    expect(service.storage.remove).toHaveBeenCalledWith([KEY]);
    expect(failedUpdate()).toBeDefined();
    expect(setup.afterCallbacks).toHaveLength(0);
  });

  it("rejects a file that was never uploaded", async () => {
    service.storage.download.mockResolvedValue({ data: null, error: { message: "Object not found" } });
    const res = await finalize();
    expect(res.status).toBe(422);
    expect(failedUpdate()).toBeDefined();
  });

  it("returns 401 when signed out", async () => {
    state.signedIn = false;
    const res = await finalize();
    expect(res.status).toBe(401);
    expect(service.client.from).not.toHaveBeenCalled();
  });

  it("returns 404 for another owner's project, without a service-client call", async () => {
    const res = await finalize(body, OTHER_PROJECT_ID);
    expect(res.status).toBe(404);
    expect(service.client.from).not.toHaveBeenCalled();
    expect(service.storageFrom).not.toHaveBeenCalled();
  });

  it("returns 400 for a bad source id", async () => {
    const res = await finalize({ sourceId: "nope" });
    expect(res.status).toBe(400);
  });

  it("allows enough time to process a 10 MB PDF after responding", () => {
    expect(maxDuration).toBeGreaterThanOrEqual(300);
  });
});
