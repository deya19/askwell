"use client";

import type { KnowledgeSourceStatus, KnowledgeSourceType } from "@askwell/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { deleteSource } from "./api";
import { isPending, statusLabel, typeLabel } from "./copy";

export type SourceRowData = {
  id: string;
  title: string;
  type: KnowledgeSourceType;
  status: KnowledgeSourceStatus;
  /** Pre-formatted on the server, so it renders the same in both places. */
  created: string;
};

/** One source: title (rendered as text, never HTML), type, created date, status and Delete. */
export function SourceRow({ source }: { source: SourceRowData }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = deleting || refreshing;

  async function remove() {
    // A simple confirm is enough: one source is easy to add again.
    if (busy || !window.confirm(`Delete "${source.title}"? The bot will stop using it.`)) return;

    setDeleting(true);
    setError(null);
    const result = await deleteSource(source.id);
    setDeleting(false);

    // A 404 means it's already gone: treat it as deleted.
    if (result.ok || result.code === "not_found") {
      startRefresh(() => router.refresh());
      return;
    }
    setError(result.message);
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <h2 className="truncate font-medium" title={source.title}>
          {source.title}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {typeLabel(source.type)}
          <span aria-hidden className="mx-2">
            ·
          </span>
          Added {source.created}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        <StatusPill status={source.status} />
        <Button variant="secondary" size="sm" onClick={remove} disabled={busy}>
          {busy ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: KnowledgeSourceStatus }) {
  const pending = isPending(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-medium",
        status === "ready" && "border-fg/20 bg-fg/5 text-fg",
        status === "failed" && "border-fg bg-fg text-bg",
        pending && "border-border text-muted",
      )}
    >
      {pending && <span aria-hidden className="size-1.5 animate-pulse rounded-pill bg-current" />}
      {statusLabel(status)}
    </span>
  );
}
