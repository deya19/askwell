"use client";

import type { Plan } from "@askwell/shared";
import { useRouter } from "next/navigation";
import { startTransition, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { deleteSource, finalizeUpload, requestUploadUrl, uploadToSignedUrl } from "./api";
import { checkKnowledgeFile, FILE_SIZE_MESSAGE, KNOWLEDGE_FILE_ACCEPT, progressLabel } from "./copy";
import { LimitMessage } from "./limit-message";

type Step = { kind: "idle" } | { kind: "uploading"; percent: string } | { kind: "checking" };
type FormError = { kind: "limit" } | { kind: "other"; message: string };

/**
 * Upload a file (project.md §6.4 Upload): `upload-url` reserves the source and signs a
 * one-time URL → the browser PUTs the file straight to Storage → `finalize` checks it
 * and starts processing. The file is checked here first for a quick message; the server
 * checks it again.
 */
export function UploadForm({ projectId, plan }: { projectId: string; plan: Plan }) {
  const router = useRouter();
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [error, setError] = useState<FormError | null>(null);
  const busy = step.kind !== "idle";

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    setError(null);
    if (!picked) return setFile(null);
    const check = checkKnowledgeFile(picked);
    if (!check.ok) {
      setFile(null);
      event.target.value = "";
      setError({ kind: "other", message: check.message });
      return;
    }
    setFile(picked);
  }

  function reset() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;
    const check = checkKnowledgeFile(file);
    if (!check.ok) return setError({ kind: "other", message: check.message });

    setError(null);
    setStep({ kind: "uploading", percent: "0%" });

    const reserved = await requestUploadUrl(projectId, { fileName: file.name, size: file.size });
    if (!reserved.ok) {
      setStep({ kind: "idle" });
      setError(reserved.code === "limit_reached" ? { kind: "limit" } : { kind: "other", message: reserved.message });
      return;
    }
    const { source, upload } = reserved.data;

    const uploaded = await uploadToSignedUrl(upload.signedUrl, file, check.mimeType, (loaded, total) =>
      setStep({ kind: "uploading", percent: progressLabel(loaded, total) }),
    );
    if (!uploaded.ok) {
      // Give the slot back: an unfinished reservation would count toward the limit for 2 hours.
      await deleteSource(source.id);
      setStep({ kind: "idle" });
      setError({ kind: "other", message: uploaded.message });
      return;
    }

    setStep({ kind: "checking" });
    const finalized = await finalizeUpload(projectId, source.id);
    setStep({ kind: "idle" });
    reset();
    // Refresh either way: a refused file now shows as Failed (the owner can delete it).
    startTransition(() => router.refresh());
    if (!finalized.ok) setError({ kind: "other", message: finalized.message });
  }

  return (
    <form onSubmit={submit} aria-label="Upload file">
      <label htmlFor={inputId} className="text-sm font-medium">
        File
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={KNOWLEDGE_FILE_ACCEPT}
        onChange={pick}
        disabled={busy}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        className="mt-2 block w-full min-w-0 rounded-pill border border-border bg-bg-raised text-sm text-muted file:mr-3 file:h-10 file:cursor-pointer file:rounded-pill file:border-0 file:border-r file:border-border file:bg-glass-strong file:px-4 file:text-sm file:font-medium file:text-fg focus-visible:border-fg/40 focus-visible:outline-none disabled:opacity-50"
      />
      <p id={hintId} className="mt-2 text-xs text-muted">
        PDF, Markdown or TXT. {FILE_SIZE_MESSAGE}
      </p>

      {busy && (
        <div className="mt-4" role="status" aria-live="polite">
          <div className="flex justify-between text-sm">
            <span>{step.kind === "uploading" ? "Uploading…" : "Checking the file…"}</span>
            {step.kind === "uploading" && <span className="tabular-nums text-muted">{step.percent}</span>}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-fg/10">
            <div
              className="h-full rounded-pill bg-accent transition-[width] duration-200"
              style={{ width: step.kind === "uploading" ? step.percent : "100%" }}
            />
          </div>
        </div>
      )}

      {error &&
        (error.kind === "limit" ? (
          <div className="mt-3">
            <LimitMessage plan={plan} id={errorId} />
          </div>
        ) : (
          <p id={errorId} role="alert" className="mt-3 text-sm text-pretty">
            {error.message}
          </p>
        ))}

      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={!file || busy} className="w-full sm:w-auto">
          {busy ? "Uploading…" : "Upload file"}
        </Button>
      </div>
    </form>
  );
}
