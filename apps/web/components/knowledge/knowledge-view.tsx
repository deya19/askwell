"use client";

import type { Plan } from "@askwell/shared";
import { useState, type ReactNode } from "react";
import { StatePanel } from "@/components/dashboard/states";
import { GlassPanel } from "@/components/ui/glass-panel";
import { cn } from "@/components/ui/cn";
import { AddTextForm } from "./add-text-form";
import { atSourceLimit, isPending, sourceCountLabel } from "./copy";
import { LimitMessage } from "./limit-message";
import { SourceRow, type SourceRowData } from "./source-row";
import { UploadForm } from "./upload-form";
import { useRefreshWhile } from "./use-refresh-while";

type Tab = "text" | "file";

/** The Knowledge page body: the add panel (paste or upload), the count, and the sources. */
export function KnowledgeView({
  projectId,
  plan,
  sources,
}: {
  projectId: string;
  plan: Plan;
  sources: SourceRowData[];
}) {
  const [tab, setTab] = useState<Tab>("text");
  const atLimit = atSourceLimit(sources.length, plan);
  useRefreshWhile(sources.some((source) => isPending(source.status)));

  return (
    <>
      <GlassPanel strong className="mt-8 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" aria-label="Add knowledge" className="flex rounded-pill border border-border bg-bg-raised p-1">
            <TabButton active={tab === "text"} onClick={() => setTab("text")}>
              Paste text
            </TabButton>
            <TabButton active={tab === "file"} onClick={() => setTab("file")}>
              Upload file
            </TabButton>
          </div>
          <p className="text-sm text-muted" aria-live="polite">
            {sourceCountLabel(sources.length, plan)}
          </p>
        </div>

        <div className="mt-4">
          {atLimit ? (
            <LimitMessage plan={plan} />
          ) : tab === "text" ? (
            <AddTextForm projectId={projectId} plan={plan} />
          ) : (
            <UploadForm projectId={projectId} plan={plan} />
          )}
        </div>
      </GlassPanel>

      {sources.length === 0 ? (
        <StatePanel icon={<BookIcon />} title="No knowledge yet">
          Paste your product info or upload a file. The bot answers from what you add here.
        </StatePanel>
      ) : (
        <GlassPanel className="mt-6 overflow-hidden">
          <ul className="divide-y divide-border">
            {sources.map((source) => (
              <SourceRow key={source.id} source={source} />
            ))}
          </ul>
        </GlassPanel>
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "h-8 flex-1 rounded-pill px-4 text-sm font-medium whitespace-nowrap transition duration-200 sm:flex-none",
        active ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 4.5h10.5A3.5 3.5 0 0 1 19 8v11.5H8.5A3.5 3.5 0 0 1 5 16V4.5Z" />
      <path d="M5 16a3.5 3.5 0 0 1 3.5-3.5H19M9 8.5h6" />
    </svg>
  );
}
