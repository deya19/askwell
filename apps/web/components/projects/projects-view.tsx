"use client";

import type { Plan } from "@askwell/shared";
import { useState } from "react";
import { PageHeader, ProjectsIcon, StatePanel } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { CreateProjectForm } from "./create-project-form";
import { ProjectRow, type ProjectRowData } from "./project-row";

/** The projects page body: header, create form, and the list or the empty state. */
export function ProjectsView({ plan, projects }: { plan: Plan; projects: ProjectRowData[] }) {
  const [creating, setCreating] = useState(false);
  const empty = projects.length === 0;

  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project is one chat widget, with its own knowledge and settings."
        actions={
          !empty && (
            <Button onClick={() => setCreating(true)} disabled={creating} className="w-full sm:w-auto">
              <PlusIcon />
              New project
            </Button>
          )
        }
      />

      {creating && <CreateProjectForm plan={plan} onDone={() => setCreating(false)} />}

      {empty ? (
        !creating && (
          <StatePanel
            icon={<ProjectsIcon />}
            title="No projects yet"
            action={
              <Button onClick={() => setCreating(true)}>
                <PlusIcon />
                Create your first project
              </Button>
            }
          >
            Create a project, add your product info, and paste one script tag on your site.
          </StatePanel>
        )
      ) : (
        <GlassPanel className="mt-8 overflow-hidden">
          <ul className="divide-y divide-border">
            {projects.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </ul>
        </GlassPanel>
      )}
    </>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
