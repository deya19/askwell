import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/states";
import { BackToProjects, InstallView } from "@/components/install/install-view";
import { installSnippet } from "@/components/install/snippet";
import { getAppUrl } from "@/lib/app-url";
import { getOwnedProject } from "@/lib/supabase/owned-project";

export const metadata: Metadata = { title: "Install" };

/** How to put the project's widget on a site (project.md §6.9). */
export default async function InstallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // RLS: null for a project that doesn't exist or isn't the caller's. Same 404 for both.
  const project = await getOwnedProject(id);
  if (!project) notFound();

  const snippet = installSnippet(await getAppUrl(), project.public_key);

  return (
    <>
      <BackToProjects />
      <div className="mt-4">
        <PageHeader
          title="Install"
          description={`Add the ${project.name} chat widget to your site with one script tag.`}
        />
      </div>
      <InstallView snippet={snippet} />
    </>
  );
}
