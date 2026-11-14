"use client";

import { MAX_KNOWLEDGE_TEXT_LENGTH, MAX_KNOWLEDGE_TITLE_LENGTH, type Plan } from "@askwell/shared";
import { useRouter } from "next/navigation";
import { startTransition, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { createTextSource } from "./api";
import { LimitMessage } from "./limit-message";

type FormError = { kind: "limit" } | { kind: "other"; message: string };

const fieldClasses =
  "w-full min-w-0 border border-border bg-bg-raised px-4 text-sm outline-none placeholder:text-muted focus:border-fg/40";

/** Paste text: title + content → `POST /api/projects/:id/knowledge`. The server enforces the limit. */
export function AddTextForm({ projectId, plan }: { projectId: string; plan: Plan }) {
  const router = useRouter();
  const titleId = useId();
  const contentId = useId();
  const errorId = useId();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const ready = title.trim() !== "" && content.trim() !== "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || pending) return;

    setPending(true);
    setError(null);
    const result = await createTextSource(projectId, { title: title.trim(), content: content.trim() });
    setPending(false);

    if (result.ok) {
      setTitle("");
      setContent("");
      startTransition(() => router.refresh());
      return;
    }
    setError(result.code === "limit_reached" ? { kind: "limit" } : { kind: "other", message: result.message });
  }

  const describedBy = error ? errorId : undefined;

  return (
    <form onSubmit={submit} aria-label="Paste text">
      <label htmlFor={titleId} className="text-sm font-medium">
        Title
      </label>
      <input
        id={titleId}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={MAX_KNOWLEDGE_TITLE_LENGTH}
        placeholder="e.g. Shipping and returns"
        autoComplete="off"
        required
        aria-describedby={describedBy}
        className={`${fieldClasses} mt-2 h-10 rounded-pill`}
      />

      <label htmlFor={contentId} className="mt-4 block text-sm font-medium">
        Content
      </label>
      <textarea
        id={contentId}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={MAX_KNOWLEDGE_TEXT_LENGTH}
        rows={6}
        placeholder="Paste FAQs, policies or product details."
        required
        aria-describedby={describedBy}
        className={`${fieldClasses} mt-2 block resize-y rounded-md py-3 leading-relaxed`}
      />
      <p className="mt-1 text-right text-xs text-muted">
        {content.length.toLocaleString("en-US")} / {MAX_KNOWLEDGE_TEXT_LENGTH.toLocaleString("en-US")}
      </p>

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
        <Button type="submit" disabled={!ready || pending} className="w-full sm:w-auto">
          {pending ? "Adding…" : "Add text"}
        </Button>
      </div>
    </form>
  );
}
