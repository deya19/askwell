import {
  APP_NAME,
  KNOWLEDGE_FILE_MIME_TYPES,
  MAX_KNOWLEDGE_FILE_BYTES,
  PLAN_LIMITS,
  knowledgeFileTypeFromName,
  type KnowledgeFileType,
  type KnowledgeSourceStatus,
  type KnowledgeSourceType,
  type Plan,
} from "@askwell/shared";

const PLAN_NAMES: Record<Plan, string> = { free: "Free", pro: "Pro" };

/** What the file input accepts. The browser hint only; `checkKnowledgeFile` is the real check. */
export const KNOWLEDGE_FILE_ACCEPT = ".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain";

export const FILE_TYPE_MESSAGE = "Upload a PDF, Markdown or TXT file.";
export const FILE_SIZE_MESSAGE = `Files can be up to ${MAX_KNOWLEDGE_FILE_BYTES / (1024 * 1024)} MB.`;
export const FILE_EMPTY_MESSAGE = "This file is empty.";

export type FileCheck = { ok: true; type: KnowledgeFileType; mimeType: string } | { ok: false; message: string };

/**
 * A quick check in the browser, so a wrong file gets a message before any request.
 * The server checks again at `upload-url` and `finalize` (project.md §9 File upload).
 */
export function checkKnowledgeFile(file: { name: string; size: number }): FileCheck {
  const type = knowledgeFileTypeFromName(file.name);
  if (!type) return { ok: false, message: FILE_TYPE_MESSAGE };
  if (file.size > MAX_KNOWLEDGE_FILE_BYTES) return { ok: false, message: FILE_SIZE_MESSAGE };
  if (file.size <= 0) return { ok: false, message: FILE_EMPTY_MESSAGE };
  // From the extension, not `file.type`: browsers often leave it empty for .md files.
  return { ok: true, type, mimeType: KNOWLEDGE_FILE_MIME_TYPES[type] };
}

/** `uploading` shows as Processing (project.md §6.4). */
export function statusLabel(status: KnowledgeSourceStatus): string {
  switch (status) {
    case "uploading":
    case "processing":
      return "Processing";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
  }
}

/** True while the source is still being uploaded or processed. */
export function isPending(status: KnowledgeSourceStatus): boolean {
  return status === "uploading" || status === "processing";
}

const TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  text: "Text",
  pdf: "PDF",
  md: "Markdown",
  txt: "TXT",
};

export function typeLabel(type: KnowledgeSourceType): string {
  return TYPE_LABELS[type];
}

/** "2 of 3 sources", against the plan's limit from `PLAN_LIMITS`. */
export function sourceCountLabel(count: number, plan: Plan): string {
  const limit = PLAN_LIMITS[plan].knowledgeSources;
  return `${count} of ${limit} ${limit === 1 ? "source" : "sources"}`;
}

/** True when the project has used every source its plan allows. */
export function atSourceLimit(count: number, plan: Plan): boolean {
  return count >= PLAN_LIMITS[plan].knowledgeSources;
}

/** Shown at the limit, and after a 402 `limit_reached`. Same style as the projects page. */
export function sourceLimitMessage(plan: Plan): string {
  const limit = PLAN_LIMITS[plan].knowledgeSources;
  const included = `The ${PLAN_NAMES[plan]} plan includes ${limit} knowledge sources per project.`;
  if (plan === "pro") return `${included} Delete one to add another.`;
  return `${included} ${APP_NAME} Pro allows up to ${PLAN_LIMITS.pro.knowledgeSources}.`;
}

/** The Knowledge page for a project. */
export function knowledgePath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/knowledge`;
}

/** "42%" for an upload in progress. */
export function progressLabel(loaded: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.min(100, Math.round((loaded / total) * 100))}%`;
}
