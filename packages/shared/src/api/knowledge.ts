import { z } from "zod";
import {
  knowledgeFileTypeFromName,
  knowledgeSourceStatusSchema,
  knowledgeSourceTypeSchema,
} from "../domain";
import {
  MAX_KNOWLEDGE_FILE_BYTES,
  MAX_KNOWLEDGE_TEXT_LENGTH,
  MAX_KNOWLEDGE_TITLE_LENGTH,
} from "../limits";
import { idSchema, timestampSchema } from "./common";

// Owner routes: Clerk session required.

export const knowledgeTitleSchema = z.string().trim().min(1).max(MAX_KNOWLEDGE_TITLE_LENGTH);

/** A knowledge source as the dashboard sees it. */
export const knowledgeSourceSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  title: z.string(),
  type: knowledgeSourceTypeSchema,
  status: knowledgeSourceStatusSchema,
  createdAt: timestampSchema,
});
export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;

/** Response of the knowledge routes that create or finalize a source. */
export const knowledgeSourceResponseSchema = z.object({ source: knowledgeSourceSchema });
export type KnowledgeSourceResponse = z.infer<typeof knowledgeSourceResponseSchema>;

/** `POST /api/projects/:id/knowledge` body: pasted text. Responds with `KnowledgeSourceResponse`. */
export const createTextSourceRequestSchema = z.object({
  title: knowledgeTitleSchema,
  content: z.string().trim().min(1).max(MAX_KNOWLEDGE_TEXT_LENGTH),
});
export type CreateTextSourceRequest = z.infer<typeof createTextSourceRequestSchema>;

/**
 * `POST /api/projects/:id/knowledge/upload-url` body. The declared name and size are checked
 * here; the real size and bytes are checked again at finalize (project.md §9).
 */
export const createUploadUrlRequestSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((name) => knowledgeFileTypeFromName(name) !== null, {
      message: "Upload a PDF, Markdown or TXT file",
    }),
  size: z.number().int().positive().max(MAX_KNOWLEDGE_FILE_BYTES, "Files can be up to 10 MB"),
  /** Defaults to the file name. */
  title: knowledgeTitleSchema.optional(),
});
export type CreateUploadUrlRequest = z.infer<typeof createUploadUrlRequestSchema>;

/** `POST /api/projects/:id/knowledge/upload-url` response: the reserved source and a one-time signed upload. */
export const createUploadUrlResponseSchema = z.object({
  source: knowledgeSourceSchema,
  upload: z.object({
    /** Object path in the `knowledge` bucket. */
    path: z.string().min(1),
    /** Token for `storage.from("knowledge").uploadToSignedUrl(path, token, file)`. */
    token: z.string().min(1),
    signedUrl: z.url(),
  }),
});
export type CreateUploadUrlResponse = z.infer<typeof createUploadUrlResponseSchema>;

/** `POST /api/projects/:id/knowledge/finalize` body. Responds with `KnowledgeSourceResponse`. */
export const finalizeUploadRequestSchema = z.object({ sourceId: idSchema });
export type FinalizeUploadRequest = z.infer<typeof finalizeUploadRequestSchema>;

// `DELETE /api/knowledge/:id` returns `OkResponse`.
