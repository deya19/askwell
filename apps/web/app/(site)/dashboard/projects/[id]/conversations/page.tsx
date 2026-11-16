import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/states";
import { ConversationList } from "@/components/conversations/conversation-list";
import { toConversationRows } from "@/components/conversations/copy";
import { RefreshButton } from "@/components/conversations/refresh-button";
import { BackToProjects } from "@/components/install/install-view";
import { listConversations } from "@/lib/conversations/queries";
import { getOwnedProject } from "@/lib/supabase/owned-project";

export const metadata: Metadata = { title: "Conversations" };

/** A project's conversations, newest first (project.md §6.7). */
export default async function ConversationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // RLS: null for a project that doesn't exist or isn't the caller's. Same 404 for both.
  const project = await getOwnedProject(id);
  if (!project) notFound();

  const { conversations } = await listConversations(project.id);

  return (
    <>
      <BackToProjects />
      <div className="mt-4">
        <PageHeader
          title="Conversations"
          description={`What visitors asked the ${project.name} bot, newest first.`}
          actions={<RefreshButton />}
        />
      </div>
      <ConversationList projectId={project.id} rows={toConversationRows(project.id, conversations)} />
    </>
  );
}
