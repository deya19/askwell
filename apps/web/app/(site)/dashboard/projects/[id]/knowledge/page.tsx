import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/states";
import { BackToProjects } from "@/components/install/install-view";
import { KnowledgeView } from "@/components/knowledge/knowledge-view";
import { loadKnowledgePage } from "@/components/knowledge/load-knowledge";
import { formatCreatedDate } from "@/components/projects/copy";
import { getOwnedProject } from "@/lib/supabase/owned-project";

export const metadata: Metadata = { title: "Knowledge" };

/** What the project's bot knows: pasted texts and uploaded files (project.md §6.4). */
export default async function KnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // RLS: null for a project that doesn't exist or isn't the caller's. Same 404 for both.
  const project = await getOwnedProject(id);
  if (!project) notFound();

  const { plan, sources } = await loadKnowledgePage(project.id);

  return (
    <>
      <BackToProjects />
      <div className="mt-4">
        <PageHeader
          title="Knowledge"
          description={`What the ${project.name} bot knows. Paste text or upload a PDF, Markdown or TXT file.`}
        />
      </div>
      <KnowledgeView
        projectId={project.id}
        plan={plan}
        sources={sources.map((source) => ({
          id: source.id,
          title: source.title,
          type: source.type,
          status: source.status,
          created: formatCreatedDate(source.createdAt),
        }))}
      />
    </>
  );
}
