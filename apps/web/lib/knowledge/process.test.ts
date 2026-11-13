import { beforeEach, describe, expect, it, vi } from "vitest";
import { eqValue, fakeSupabase, type DbResult, type Handler, type Query } from "./fake-supabase";

vi.mock("server-only", () => ({}));

const embedTexts = vi.fn<(texts: string[]) => Promise<number[][]>>();
vi.mock("../ai/embeddings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ai/embeddings")>();
  return { ...actual, embedTexts };
});

const { CHUNK_INSERT_BATCH_SIZE, extractSourceText, processKnowledgeSource } = await import("./process");
const { CHUNK_MAX_CHARS } = await import("./chunk");

const SOURCE = { id: "11111111-1111-4111-8111-111111111111", projectId: "22222222-2222-4222-8222-222222222222" };

/** A minimal one-page PDF that shows `text`. */
function minimalPdf(text: string): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

function vector(seed: number): number[] {
  return Array.from({ length: 1536 }, (_, i) => (i === 0 ? seed : 0));
}

function setup(overrides: (q: Query) => DbResult | undefined = () => undefined) {
  const handler: Handler = (q) => overrides(q) ?? { data: null, error: null };
  return fakeSupabase(handler);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  embedTexts.mockImplementation(async (texts) => texts.map((_, i) => vector(i)));
});

describe("extractSourceText", () => {
  it("returns pasted text as is", async () => {
    await expect(extractSourceText("text", { kind: "text", text: "Hello" })).resolves.toBe("Hello");
  });

  it("decodes Markdown and TXT as UTF-8", async () => {
    const bytes = new TextEncoder().encode("# Café ☕\n\nRefunds in 30 days.");
    await expect(extractSourceText("md", { kind: "file", bytes })).resolves.toBe("# Café ☕\n\nRefunds in 30 days.");
    await expect(extractSourceText("txt", { kind: "file", bytes })).resolves.toContain("Café ☕");
  });

  it("extracts the text of a real PDF with unpdf", async () => {
    const text = await extractSourceText("pdf", { kind: "file", bytes: minimalPdf("Refunds take 30 days") });
    expect(text).toContain("Refunds take 30 days");
  });

  it("throws on bytes that aren't a PDF", async () => {
    await expect(
      extractSourceText("pdf", { kind: "file", bytes: new TextEncoder().encode("%PDF- not really") }),
    ).rejects.toThrow();
  });
});

describe("processKnowledgeSource", () => {
  it("chunks, embeds, inserts the chunks and marks the source ready", async () => {
    const fake = setup();
    const text = "We ship worldwide.\n\nReturns are accepted within 30 days.";

    const result = await processKnowledgeSource(
      fake.client as never,
      { ...SOURCE, type: "text" },
      { kind: "text", text },
    );

    expect(result).toBe("ready");
    expect(embedTexts).toHaveBeenCalledWith(["We ship worldwide.\n\nReturns are accepted within 30 days."]);
    const insert = fake.queries.find((q) => q.op === "insert");
    expect(insert?.table).toBe("knowledge_chunks");
    const rows = insert?.payload as { project_id: string; source_id: string; content: string; embedding: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ project_id: SOURCE.projectId, source_id: SOURCE.id });
    expect(rows[0]?.embedding.startsWith("[0,0,")).toBe(true);

    const update = fake.queries.find((q) => q.op === "update");
    expect(update?.payload).toEqual({ status: "ready" });
    expect(eqValue(update as Query, "id")).toBe(SOURCE.id);
    expect(eqValue(update as Query, "status")).toBe("processing");
  });

  it("processes a PDF file end to end", async () => {
    const fake = setup();
    const result = await processKnowledgeSource(
      fake.client as never,
      { ...SOURCE, type: "pdf" },
      { kind: "file", bytes: minimalPdf("Our office opens at 9am") },
    );
    expect(result).toBe("ready");
    expect(embedTexts.mock.calls[0]?.[0][0]).toContain("Our office opens at 9am");
  });

  it("inserts many chunks in batches, each chunk with its own vector", async () => {
    const fake = setup();
    const paragraph = "This sentence is about shipping and refunds and support hours. ".repeat(50);
    const text = Array.from({ length: 250 }, (_, i) => `Part ${i}. ${paragraph}`).join("\n\n");

    await processKnowledgeSource(fake.client as never, { ...SOURCE, type: "text" }, { kind: "text", text });

    const inserts = fake.queries.filter((q) => q.op === "insert");
    const chunkCount = embedTexts.mock.calls[0]?.[0].length ?? 0;
    expect(chunkCount).toBeGreaterThan(CHUNK_INSERT_BATCH_SIZE);
    expect(inserts).toHaveLength(Math.ceil(chunkCount / CHUNK_INSERT_BATCH_SIZE));
    const rows = inserts.flatMap((q) => q.payload as { content: string; embedding: string }[]);
    expect(rows).toHaveLength(chunkCount);
    rows.forEach((row, i) => {
      expect(row.content.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
      expect(row.embedding.startsWith(`[${i},`)).toBe(true);
    });
  });

  it("marks the source failed when the text is empty", async () => {
    const fake = setup();
    const result = await processKnowledgeSource(
      fake.client as never,
      { ...SOURCE, type: "txt" },
      { kind: "file", bytes: new TextEncoder().encode("  \n\n\t ") },
    );
    expect(result).toBe("failed");
    expect(embedTexts).not.toHaveBeenCalled();
    expect(fake.queries.find((q) => q.op === "update")?.payload).toEqual({ status: "failed" });
  });

  it("marks the source failed, removes partial chunks and logs when embedding fails", async () => {
    const fake = setup();
    embedTexts.mockRejectedValue(new Error("429 Rate limit reached"));

    const result = await processKnowledgeSource(fake.client as never, { ...SOURCE, type: "text" }, { kind: "text", text: "Hi there." });

    expect(result).toBe("failed");
    const cleanup = fake.queries.find((q) => q.op === "delete");
    expect(cleanup?.table).toBe("knowledge_chunks");
    expect(eqValue(cleanup as Query, "source_id")).toBe(SOURCE.id);
    expect(fake.queries.find((q) => q.op === "update")?.payload).toEqual({ status: "failed" });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(SOURCE.id), expect.any(Error));
  });

  it("marks the source failed when a chunk insert fails", async () => {
    const fake = setup((q) => (q.op === "insert" ? { data: null, error: { message: "insert failed" } } : undefined));
    const result = await processKnowledgeSource(fake.client as never, { ...SOURCE, type: "text" }, { kind: "text", text: "Hi there." });
    expect(result).toBe("failed");
    expect(fake.queries.find((q) => q.op === "update")?.payload).toEqual({ status: "failed" });
  });

  it("marks the source failed for a broken PDF", async () => {
    const fake = setup();
    const result = await processKnowledgeSource(
      fake.client as never,
      { ...SOURCE, type: "pdf" },
      { kind: "file", bytes: new TextEncoder().encode("%PDF-1.4 garbage") },
    );
    expect(result).toBe("failed");
  });

  it("never throws, even if marking failed fails too", async () => {
    const fake = setup((q) => (q.op === "select" ? undefined : { data: null, error: { message: "db down" } }));
    embedTexts.mockRejectedValue(new Error("boom"));
    await expect(
      processKnowledgeSource(fake.client as never, { ...SOURCE, type: "text" }, { kind: "text", text: "Hi." }),
    ).resolves.toBe("failed");
  });
});
