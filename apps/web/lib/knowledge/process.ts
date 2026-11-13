import "server-only";
import type { KnowledgeSourceType } from "@askwell/shared";
import { extractText } from "unpdf";
import { embedTexts, toPgVector } from "../ai/embeddings";
import type { ServiceClient } from "../supabase/service";
import { chunkText } from "./chunk";

/** Chunk rows per insert. Each row carries a 1536-number vector, so keep requests moderate. */
export const CHUNK_INSERT_BATCH_SIZE = 100;

export type ProcessInput =
  | { kind: "text"; text: string }
  | { kind: "file"; bytes: Uint8Array };

export type ProcessTarget = { id: string; projectId: string; type: KnowledgeSourceType };

/** Pulls the text out of a source: PDF through `unpdf`, Markdown and TXT as UTF-8. */
export async function extractSourceText(type: KnowledgeSourceType, input: ProcessInput): Promise<string> {
  if (input.kind === "text") return input.text;
  if (type !== "pdf") return new TextDecoder("utf-8").decode(input.bytes);

  // pdf.js takes ownership of (detaches) the buffer it's given, so hand it a copy.
  const { text } = await extractText(new Uint8Array(input.bytes), { mergePages: true });
  return text;
}

/**
 * Turns a `processing` source into chunks (project.md §6.4 Processing): extract the text,
 * `chunkText`, embed, insert the chunks, then mark the source `ready`.
 *
 * Never throws. Any failure (including empty text) marks the source `failed`, removes chunks
 * it already wrote, and logs the cause on the server. Runs after the response, via `after()`.
 */
export async function processKnowledgeSource(
  supabase: ServiceClient,
  source: ProcessTarget,
  input: ProcessInput,
): Promise<"ready" | "failed"> {
  try {
    const text = await extractSourceText(source.type, input);
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("No text found in the source.");

    const vectors = await embedTexts(chunks);
    for (let start = 0; start < chunks.length; start += CHUNK_INSERT_BATCH_SIZE) {
      const rows = chunks.slice(start, start + CHUNK_INSERT_BATCH_SIZE).map((content, i) => ({
        project_id: source.projectId,
        source_id: source.id,
        content,
        embedding: toPgVector(vectors[start + i] ?? []),
      }));
      const { error } = await supabase.from("knowledge_chunks").insert(rows);
      if (error) throw new Error(`Could not insert chunks: ${error.message}`);
    }

    await setStatus(supabase, source.id, "ready");
    return "ready";
  } catch (cause) {
    console.error(`Knowledge source ${source.id} failed to process:`, cause);
    await markFailed(supabase, source.id);
    return "failed";
  }
}

async function setStatus(supabase: ServiceClient, sourceId: string, status: "ready" | "failed"): Promise<void> {
  const { error } = await supabase
    .from("knowledge_sources")
    .update({ status })
    .eq("id", sourceId)
    .eq("status", "processing");
  if (error) throw new Error(`Could not set status ${status}: ${error.message}`);
}

/** Best effort: removes partial chunks, then marks the source `failed`. Logs, never throws. */
async function markFailed(supabase: ServiceClient, sourceId: string): Promise<void> {
  try {
    const { error } = await supabase.from("knowledge_chunks").delete().eq("source_id", sourceId);
    if (error) throw new Error(`Could not remove partial chunks: ${error.message}`);
  } catch (cause) {
    console.error(`Knowledge source ${sourceId}:`, cause);
  }
  try {
    await setStatus(supabase, sourceId, "failed");
  } catch (cause) {
    console.error(`Knowledge source ${sourceId}:`, cause);
  }
}
