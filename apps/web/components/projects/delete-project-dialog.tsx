"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { deleteProject } from "./api";
import { deleteConfirmMatches } from "./copy";

/**
 * Confirms a delete. The Delete button stays disabled until the owner types the
 * project's exact name (product owner decision, 2026-11-11). Native `<dialog>`,
 * so focus is trapped and Escape closes it.
 */
export function DeleteProjectDialog({
  project,
  onClose,
  onDeleted,
}: {
  project: { id: string; name: string };
  onClose: () => void;
  onDeleted: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = deleteConfirmMatches(typed, project.name);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches || pending) return;

    setPending(true);
    setError(null);
    const result = await deleteProject(project.id);
    setPending(false);

    // A 404 means it's already gone: treat it as deleted.
    if (result.ok || result.code === "not_found") {
      onDeleted();
      return;
    }
    setError(result.message);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => pending && e.preventDefault()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-bg-raised p-0 text-fg shadow-panel backdrop:bg-ink-950/30 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={submit} className="p-5 sm:p-6">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          Delete project
        </h2>
        <p className="mt-2 text-sm text-pretty text-muted">
          This deletes <span className="font-medium break-words text-fg">{project.name}</span> and all its
          conversations and knowledge. It can&apos;t be undone.
        </p>

        <label htmlFor={inputId} className="mt-5 block text-sm">
          Type <span className="font-mono font-medium break-all">{project.name}</span> to confirm.
        </label>
        <input
          id={inputId}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="mt-2 h-10 w-full rounded-pill border border-border bg-bg px-4 text-sm outline-none focus:border-fg/40"
        />

        {error && (
          <p role="alert" className="mt-3 text-sm">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => dialogRef.current?.close()} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={!matches || pending}>
            {pending ? "Deleting…" : "Delete project"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
