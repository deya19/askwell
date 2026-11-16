import { idSchema } from "@askwell/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/states";
import { conversationsPath, fullTimeLabel, messageCountLabel } from "@/components/conversations/copy";
import { RefreshButton } from "@/components/conversations/refresh-button";
import { BackToConversations, ThreadView } from "@/components/conversations/thread-view";
import { getConversation } from "@/lib/conversations/queries";
import { getOwnedProject } from "@/lib/supabase/owned-project";

export const metadata: Metadata = { title: "Conversation" };

/** One conversation's whole thread, oldest first (project.md §6.7). */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string; conversationId: string }>;
}) {
  const { id, conversationId } = await params;
  // Not a UUID: nothing can match, and Postgres would reject the cast.
  if (!idSchema.safeParse(conversationId).success) notFound();

  // RLS hides other owners' projects and conversations. A conversation from another of the
  // caller's projects 404s too, so the URL always names the project the thread is in.
  const [project, data] = await Promise.all([getOwnedProject(id), getConversation(conversationId)]);
  if (!project || !data || data.conversation.projectId !== project.id) notFound();

  const { conversation, messages } = data;

  return (
    <>
      <BackToConversations href={conversationsPath(project.id)} />
      <div className="mt-4">
        <PageHeader
          title="Conversation"
          description={`${project.name} · Started ${fullTimeLabel(conversation.createdAt)} · ${messageCountLabel(messages.length)}`}
          actions={<RefreshButton />}
        />
      </div>
      <ThreadView messages={messages.map((m) => ({ ...m, time: fullTimeLabel(m.createdAt) }))} />
    </>
  );
}
