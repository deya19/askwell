import "server-only";
import { getOpenAI } from "./openai";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./models";

/**
 * Inputs per embeddings request. OpenAI allows 2,048 inputs and 300k tokens per request;
 * 100 chunks of ~1,000 tokens stays well under both.
 */
export const EMBEDDING_BATCH_SIZE = 100;

/** Embeds `texts` in batches. Returns one 1536-number vector per text, in input order. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = getOpenAI();
  const vectors: number[][] = [];

  for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBEDDING_BATCH_SIZE);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      encoding_format: "float",
    });

    if (response.data.length !== batch.length) {
      throw new Error(`Expected ${batch.length} embeddings, got ${response.data.length}.`);
    }
    const ordered = [...response.data].sort((a, b) => a.index - b.index);
    ordered.forEach((item, i) => {
      if (item.index !== i) throw new Error(`Missing embedding for input ${start + i}.`);
      vectors.push(checkDimensions(item.embedding));
    });
  }

  return vectors;
}

/** Embeds one visitor question for `match_chunks` (§6.6 step 4). */
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  if (!vector) throw new Error("Expected 1 embedding, got 0.");
  return vector;
}

/**
 * pgvector's text form (`[0.1,0.2,...]`), as `match_chunks.query_embedding` and the
 * `knowledge_chunks.embedding` insert expect.
 */
export function toPgVector(vector: number[]): string {
  checkDimensions(vector);
  if (!vector.every(Number.isFinite)) throw new Error("Embedding has a non-finite value.");
  return `[${vector.join(",")}]`;
}

function checkDimensions(vector: number[]): number[] {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected a ${EMBEDDING_DIMENSIONS}-dimension embedding, got ${vector.length}.`);
  }
  return vector;
}
