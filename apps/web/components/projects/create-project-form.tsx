"use client";

import { MAX_PROJECT_NAME_LENGTH, type Plan } from "@askwell/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { createProject } from "./api";
import { limitReachedMessage, PRICING_PATH } from "./copy";

type FormError = { kind: "limit" } | { kind: "other"; message: string };

/** The "New project" form. Calls `POST /api/projects`; the server enforces the plan's limit. */
export function CreateProjectForm({ plan, onDone }: { plan: Plan; onDone: () => void }) {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  useEffect(() => inputRef.current?.focus(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || pending) return;

    setPending(true);
    setError(null);
    const result = await createProject({ name: trimmed });
    setPending(false);

    if (result.ok) {
      // In one transition, so the form closes when the new list arrives (no empty-state flash).
      startTransition(() => {
        router.refresh();
        onDone();
      });
      return;
    }
    setError(result.code === "limit_reached" ? { kind: "limit" } : { kind: "other", message: result.message });
  }

  return (
    <GlassPanel as="form" strong onSubmit={submit} className="mt-8 p-4 sm:p-5" aria-label="New project">
      <label htmlFor={inputId} className="text-sm font-medium">
        Project name
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          id={inputId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_PROJECT_NAME_LENGTH}
          placeholder="e.g. Docs site"
          autoComplete="off"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-10 min-w-0 flex-1 rounded-pill border border-border bg-bg-raised px-4 text-sm outline-none placeholder:text-muted focus:border-fg/40"
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || !name.trim()} className="flex-1 sm:flex-none">
            {pending ? "Creating…" : "Create project"}
          </Button>
          <Button variant="secondary" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-3 text-sm text-pretty">
          {error.kind === "limit" ? (
            <>
              {limitReachedMessage(plan)}{" "}
              {plan === "free" && (
                <Link href={PRICING_PATH} className="font-medium underline underline-offset-4">
                  See pricing
                </Link>
              )}
            </>
          ) : (
            error.message
          )}
        </p>
      )}
    </GlassPanel>
  );
}
