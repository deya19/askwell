import type { Metadata } from "next";
import { PageHeader, ProjectsIcon, StatePanel } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Projects" };

/** Projects list. Creating and listing projects comes in Phase 2; for now it's the empty state. */
export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project is one chat widget, with its own knowledge and settings."
        actions={<NewProjectButton />}
      />
      <StatePanel icon={<ProjectsIcon />} title="No projects yet">
        Create a project, add your product info, and paste one script tag on your site.
      </StatePanel>
    </>
  );
}

function NewProjectButton() {
  // Project creation ships in Phase 2.
  return (
    <Button disabled aria-disabled title="Coming soon" className="w-full sm:w-auto">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
      New project
    </Button>
  );
}
