import type { Metadata } from "next";
import { formatCreatedDate, usageLabel } from "@/components/projects/copy";
import { loadProjectsPage } from "@/components/projects/load-projects";
import { ProjectsView } from "@/components/projects/projects-view";

export const metadata: Metadata = { title: "Projects" };

/** The owner's projects (project.md §6.3). Reads through the owner client, so RLS scopes the list. */
export default async function ProjectsPage() {
  const { plan, projects } = await loadProjectsPage();

  return (
    <ProjectsView
      plan={plan}
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        created: formatCreatedDate(project.createdAt),
        usage: usageLabel(project.messagesUsed, plan),
      }))}
    />
  );
}
