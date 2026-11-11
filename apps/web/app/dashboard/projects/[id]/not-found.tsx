import Link from "next/link";
import { ProjectsIcon, StatePanel } from "@/components/dashboard/states";
import { buttonClasses } from "@/components/ui/button";

/** A project id that doesn't exist or isn't the caller's. Same page for both (project.md §9). */
export default function ProjectNotFound() {
  return (
    <StatePanel
      icon={<ProjectsIcon />}
      title="Project not found"
      action={
        <Link href="/dashboard/projects" className={buttonClasses({ variant: "secondary" })}>
          Back to projects
        </Link>
      }
    >
      This project doesn&apos;t exist, or you don&apos;t have access to it.
    </StatePanel>
  );
}
