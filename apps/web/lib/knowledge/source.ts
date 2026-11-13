import type { KnowledgeFileType, KnowledgeSource } from "@askwell/shared";
import { knowledgeSourceStatusSchema, knowledgeSourceTypeSchema } from "@askwell/shared";
import type { Tables } from "../supabase/types";

export type KnowledgeSourceRow = Tables<"knowledge_sources">;

/** The private Storage bucket for uploaded knowledge files (supabase/migrations/*_knowledge_bucket.sql). */
export const KNOWLEDGE_BUCKET = "knowledge";

/** A reservation not finalized within this long is reclaimed (project.md §6.4 Upload). */
export const STALE_UPLOAD_MS = 2 * 60 * 60 * 1000;

/** Every PDF starts with these bytes. */
const PDF_MAGIC = "%PDF-";

/** Maps a `knowledge_sources` row to the `KnowledgeSource` the API and dashboard use. */
export function toKnowledgeSource(row: KnowledgeSourceRow): KnowledgeSource {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    type: knowledgeSourceTypeSchema.parse(row.type),
    status: knowledgeSourceStatusSchema.parse(row.status),
    createdAt: row.created_at,
  };
}

/**
 * The object path for a new upload: `<projectId>/<objectId>.<type>`. The project prefix keeps
 * each project's files together; the id is random because the source id isn't known until the
 * reservation is inserted.
 */
export function storageKeyFor(projectId: string, objectId: string, type: KnowledgeFileType): string {
  return `${projectId}/${objectId}.${type}`;
}

/** A title from a file name, cut to the title limit without breaking a character. */
export function titleFromFileName(fileName: string, maxLength: number): string {
  return Array.from(fileName.trim()).slice(0, maxLength).join("").trim();
}

/** True when the bytes start with the PDF header. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) return false;
  for (let i = 0; i < PDF_MAGIC.length; i++) {
    if (bytes[i] !== PDF_MAGIC.charCodeAt(i)) return false;
  }
  return true;
}
