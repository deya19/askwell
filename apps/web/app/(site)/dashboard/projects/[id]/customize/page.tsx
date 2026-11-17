import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/states";
import { CustomizeView } from "@/components/customize/customize-view";
import { loadCustomizePage } from "@/components/customize/load-customize";
import { BackToProjects } from "@/components/install/install-view";
import { getOwnedProject } from "@/lib/supabase/owned-project";

export const metadata: Metadata = { title: "Customize" };

/** The widget's look, with a live preview (project.md §6.8). Pro only; Free sees it locked. */
export default async function CustomizePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // RLS: null for a project that doesn't exist or isn't the caller's. Same 404 for both.
  const project = await getOwnedProject(id);
  if (!project) notFound();

  // The plan is read here on the server, never taken from the client (project.md §9).
  const { canCustomize, config } = await loadCustomizePage(project.id);

  return (
    <>
      <BackToProjects />
      <div className="mt-4">
        <PageHeader
          title="Customize"
          description={`Choose how the ${project.name} chat widget looks on your site.`}
        />
      </div>
      <CustomizeView projectId={project.id} initialConfig={config} canCustomize={canCustomize} />
    </>
  );
}
