import {
  createUploadUrlResponseSchema,
  knowledgeSourceResponseSchema,
  okResponseSchema,
  type CreateTextSourceRequest,
  type CreateUploadUrlRequest,
  type CreateUploadUrlResponse,
  type KnowledgeSourceResponse,
  type OkResponse,
} from "@askwell/shared";
import { readApiResponse, type ApiResult } from "@/components/projects/api";

type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection.";

async function send<T>(url: string, init: RequestInit, schema: Schema<T>): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    return { ok: false, code: "network_error", message: NETWORK_MESSAGE };
  }
  return readApiResponse(response, schema);
}

function knowledgeUrl(projectId: string, rest = ""): string {
  return `/api/projects/${encodeURIComponent(projectId)}/knowledge${rest}`;
}

export function createTextSource(
  projectId: string,
  body: CreateTextSourceRequest,
): Promise<ApiResult<KnowledgeSourceResponse>> {
  return send(knowledgeUrl(projectId), { method: "POST", body: JSON.stringify(body) }, knowledgeSourceResponseSchema);
}

export function requestUploadUrl(
  projectId: string,
  body: CreateUploadUrlRequest,
): Promise<ApiResult<CreateUploadUrlResponse>> {
  return send(
    knowledgeUrl(projectId, "/upload-url"),
    { method: "POST", body: JSON.stringify(body) },
    createUploadUrlResponseSchema,
  );
}

export function finalizeUpload(projectId: string, sourceId: string): Promise<ApiResult<KnowledgeSourceResponse>> {
  return send(
    knowledgeUrl(projectId, "/finalize"),
    { method: "POST", body: JSON.stringify({ sourceId }) },
    knowledgeSourceResponseSchema,
  );
}

export function deleteSource(sourceId: string): Promise<ApiResult<OkResponse>> {
  return send(`/api/knowledge/${encodeURIComponent(sourceId)}`, { method: "DELETE" }, okResponseSchema);
}

export type UploadResult = { ok: true } | { ok: false; message: string };

/**
 * PUTs the file to the one-time signed Storage URL from `upload-url`. XHR, not fetch, so the
 * page can show upload progress. The content type comes from the extension: the bucket only
 * accepts the knowledge MIME types, and browsers often leave `file.type` empty for .md.
 */
export function uploadToSignedUrl(
  signedUrl: string,
  file: Blob,
  mimeType: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true });
      else resolve({ ok: false, message: "The upload failed. Try again." });
    };
    xhr.onerror = () => resolve({ ok: false, message: NETWORK_MESSAGE });
    xhr.send(file);
  });
}
