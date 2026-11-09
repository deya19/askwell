import { z } from "zod";

/** `knowledge_sources.type` (project.md §7). */
export const KNOWLEDGE_SOURCE_TYPES = ["text", "pdf", "md", "txt"] as const;
export const knowledgeSourceTypeSchema = z.enum(KNOWLEDGE_SOURCE_TYPES);
export type KnowledgeSourceType = z.infer<typeof knowledgeSourceTypeSchema>;

/** File types an owner may upload (every source type except pasted text). */
export const KNOWLEDGE_FILE_TYPES = ["pdf", "md", "txt"] as const satisfies readonly KnowledgeSourceType[];
export type KnowledgeFileType = (typeof KNOWLEDGE_FILE_TYPES)[number];

/** Allowed file extensions, mapped to their source type. */
export const KNOWLEDGE_FILE_EXTENSIONS: Record<string, KnowledgeFileType> = {
  pdf: "pdf",
  md: "md",
  markdown: "md",
  txt: "txt",
};

/** MIME types the Storage bucket accepts, per file type. */
export const KNOWLEDGE_FILE_MIME_TYPES: Record<KnowledgeFileType, string> = {
  pdf: "application/pdf",
  md: "text/markdown",
  txt: "text/plain",
};

/** The knowledge file type for a file name, or null if the extension isn't allowed. */
export function knowledgeFileTypeFromName(fileName: string): KnowledgeFileType | null {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0 || dot === fileName.length - 1) return null;
  const extension = fileName.slice(dot + 1).toLowerCase();
  return Object.hasOwn(KNOWLEDGE_FILE_EXTENSIONS, extension)
    ? (KNOWLEDGE_FILE_EXTENSIONS[extension] ?? null)
    : null;
}

/** `knowledge_sources.status` (project.md §7). `uploading` shows as processing in the UI. */
export const KNOWLEDGE_SOURCE_STATUSES = ["uploading", "processing", "ready", "failed"] as const;
export const knowledgeSourceStatusSchema = z.enum(KNOWLEDGE_SOURCE_STATUSES);
export type KnowledgeSourceStatus = z.infer<typeof knowledgeSourceStatusSchema>;

/** `messages.role` (project.md §7). */
export const MESSAGE_ROLES = ["visitor", "bot"] as const;
export const messageRoleSchema = z.enum(MESSAGE_ROLES);
export type MessageRole = z.infer<typeof messageRoleSchema>;
