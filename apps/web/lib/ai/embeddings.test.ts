import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type EmbeddingParams = { model: string; input: string[]; encoding_format?: string };
type EmbeddingResponse = { data: { index: number; embedding: number[] }[] };

const create = vi.fn<(params: EmbeddingParams) => Promise<EmbeddingResponse>>();
const constructed = vi.fn<(options: { apiKey: string }) => void>();
vi.mock("openai", () => ({
  default: class {
    embeddings = { create };
    constructor(options: { apiKey: string }) {
      constructed(options);
    }
  },
}));

const { EMBEDDING_BATCH_SIZE, embedQuery, embedTexts, toPgVector } = await import("./embeddings");
const { CHAT_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } = await import("./models");
const { getOpenAI } = await import("./openai");

/** A 1536 vector whose first value identifies the input it came from. */
function vectorFor(text: string): number[] {
  const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  v[0] = Number(text.replace("t", ""));
  return v;
}

/** Answers like OpenAI, but with `data` in reverse order to prove we sort by index. */
function answerReversed(params: EmbeddingParams): Promise<EmbeddingResponse> {
  const data = params.input.map((text, index) => ({ index, embedding: vectorFor(text) }));
  return Promise.resolve({ data: data.reverse() });
}

describe("embeddings", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    create.mockReset();
    constructed.mockClear();
  });

  it("returns nothing and calls nothing for no texts", async () => {
    expect(await embedTexts([])).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it("batches inputs and returns vectors in input order", async () => {
    create.mockImplementation(answerReversed);
    const texts = Array.from({ length: EMBEDDING_BATCH_SIZE * 2 + 5 }, (_, i) => `t${i}`);

    const vectors = await embedTexts(texts);

    expect(create).toHaveBeenCalledTimes(3);
    expect(create.mock.calls.map(([p]) => p.input.length)).toEqual([EMBEDDING_BATCH_SIZE, EMBEDDING_BATCH_SIZE, 5]);
    expect(create.mock.calls[1]?.[0].input[0]).toBe(`t${EMBEDDING_BATCH_SIZE}`);
    for (const [p] of create.mock.calls) expect(p.model).toBe(EMBEDDING_MODEL);
    expect(vectors.map((v) => v[0])).toEqual(texts.map((_, i) => i));
  });

  it("embeds one query", async () => {
    create.mockImplementation(answerReversed);
    const vector = await embedQuery("t7");
    expect(vector).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(vector[0]).toBe(7);
  });

  it("rejects a vector that isn't 1536 long", async () => {
    create.mockResolvedValue({ data: [{ index: 0, embedding: [0.1, 0.2] }] });
    await expect(embedQuery("t0")).rejects.toThrow("Expected a 1536-dimension embedding, got 2.");
  });

  it("rejects a response with missing embeddings", async () => {
    create.mockResolvedValue({ data: [{ index: 0, embedding: vectorFor("t0") }] });
    await expect(embedTexts(["t0", "t1"])).rejects.toThrow("Expected 2 embeddings, got 1.");
  });

  it("passes an OpenAI error through", async () => {
    const error = new Error("429 Rate limit reached");
    create.mockRejectedValue(error);
    await expect(embedTexts(["t0"])).rejects.toBe(error);
  });

  it("fails loudly when OPENAI_API_KEY is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(embedTexts(["t0"])).rejects.toThrow("Missing environment variable OPENAI_API_KEY.");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("toPgVector", () => {
  it("writes pgvector's text form", () => {
    const v = vectorFor("t0");
    v[0] = 0.25;
    v[1] = -1e-7;
    const text = toPgVector(v);
    expect(text.startsWith("[0.25,-1e-7,0,")).toBe(true);
    expect(text.endsWith(",0]")).toBe(true);
    expect(text.slice(1, -1).split(",")).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("rejects a wrong length or a non-finite value", () => {
    expect(() => toPgVector([1, 2, 3])).toThrow("1536-dimension");
    const v = vectorFor("t0");
    v[5] = Number.NaN;
    expect(() => toPgVector(v)).toThrow("non-finite");
  });
});

describe("getOpenAI", () => {
  beforeEach(() => constructed.mockClear());

  it("reads the key at call time and reuses one client per key", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-one");
    const a = getOpenAI();
    const b = getOpenAI();
    expect(a).toBe(b);
    vi.stubEnv("OPENAI_API_KEY", "sk-two");
    expect(getOpenAI()).not.toBe(a);
    expect(constructed.mock.calls.map(([opts]) => opts.apiKey)).toEqual(["sk-one", "sk-two"]);
  });
});

describe("models", () => {
  it("uses the 1536-dimension embedding model the chunks column expects", () => {
    expect(EMBEDDING_MODEL).toBe("text-embedding-3-small");
    expect(EMBEDDING_DIMENSIONS).toBe(1536);
    expect(CHAT_MODEL).toBe("gpt-6-luna");
  });
});

describe("OPENAI_API_KEY", () => {
  const webRoot = join(import.meta.dirname, "..", "..");
  const skip = new Set(["node_modules", ".next", "dist"]);

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      if (skip.has(name)) return [];
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.(ts|tsx|js|jsx|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
  }

  it("is read only in lib/ai/openai.ts", () => {
    const readers = sourceFiles(webRoot)
      .filter((file) => readFileSync(file, "utf8").includes("OPENAI_API_KEY"))
      .map((file) => relative(webRoot, file).replaceAll("\\", "/"));
    expect(readers).toEqual(["lib/ai/openai.ts"]);
  });

  it("modules under lib/ai are server only", () => {
    for (const file of ["openai.ts", "embeddings.ts", "models.ts"]) {
      expect(readFileSync(join(import.meta.dirname, file), "utf8")).toContain('import "server-only";');
    }
  });
});
