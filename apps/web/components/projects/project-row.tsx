"use client";

import { MAX_PROJECT_NAME_LENGTH } from "@askwell/shared";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { knowledgePath } from "@/components/knowledge/copy";
import { Button, ButtonLink } from "@/components/ui/button";
import { renameProject } from "./api";
import { installPath } from "./copy";
import { DeleteProjectDialog } from "./delete-project-dialog";

export type ProjectRowData = {
  id: string;
  name: string;
  /** Pre-formatted on the server, so it renders the same in both places. */
  created: string;
  usage: string;
};

type Mode = "view" | "rename" | "delete";

/** One project: name (rendered as text), created date, usage, and its actions. */
export function ProjectRow({ project }: { project: ProjectRowData }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [name, setName] = useState(project.name);

  return (
    <li className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      {mode === "rename" ? (
        <RenameForm
          project={{ id: project.id, name }}
          onCancel={() => setMode("view")}
          onSaved={(saved) => {
            setName(saved);
            setMode("view");
            router.refresh();
          }}
        />
      ) : (
        <>
          <div className="min-w-0">
            <h2 className="truncate font-medium" title={name}>
              {name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              <span>Created {project.created}</span>
              <span aria-hidden className="mx-2 hidden sm:inline">
                ·
              </span>
              <span className="block sm:inline">{project.usage}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <ButtonLink href={installPath(project.id)} size="sm" className="flex-1 sm:flex-none">
              Install
            </ButtonLink>
            <ButtonLink href={knowledgePath(project.id)} variant="secondary" size="sm" className="flex-1 sm:flex-none">
              Knowledge
            </ButtonLink>
            <Button variant="secondary" size="sm" className="flex-1 sm:flex-none" onClick={() => setMode("rename")}>
              Rename
            </Button>
            <Button variant="secondary" size="sm" className="flex-1 sm:flex-none" onClick={() => setMode("delete")}>
              Delete
            </Button>
          </div>
        </>
      )}

      {mode === "delete" && (
        <DeleteProjectDialog
          project={{ id: project.id, name }}
          onClose={() => setMode("view")}
          onDeleted={() => {
            setMode("view");
            router.refresh();
          }}
        />
      )}
    </li>
  );
}

function RenameForm({
  project,
  onCancel,
  onSaved,
}: {
  project: { id: string; name: string };
  onCancel: () => void;
  onSaved: (name: string) => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState(project.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || pending) return;
    if (trimmed === project.name) return onCancel();

    setPending(true);
    setError(null);
    const result = await renameProject(project.id, { name: trimmed });
    setPending(false);

    if (result.ok) onSaved(result.data.project.name);
    else setError(result.message);
  }

  return (
    <form onSubmit={submit} className="w-full" aria-label={`Rename ${project.name}`}>
      <label htmlFor={inputId} className="sr-only">
        Project name
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
          maxLength={MAX_PROJECT_NAME_LENGTH}
          autoComplete="off"
          autoFocus
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-9 min-w-0 flex-1 rounded-pill border border-border bg-bg-raised px-4 text-sm outline-none focus:border-fg/40"
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="h-9 flex-1 sm:flex-none" disabled={pending || !value.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button variant="secondary" size="sm" className="h-9 flex-1 sm:flex-none" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
