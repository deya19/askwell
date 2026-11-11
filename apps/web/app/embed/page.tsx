import type { Metadata } from "next";
import { ChatPanel } from "@/components/embed/chat-panel";
import { ChatUnavailable } from "@/components/embed/chat-unavailable";
import { loadEmbed } from "./load-embed";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

/**
 * The widget's chat panel, loaded by widget.js in an iframe on the customer's site
 * (project.md §6.5). The only page other sites may frame (see next.config.ts).
 */
export default async function EmbedPage({ searchParams }: PageProps<"/embed">) {
  const state = await loadEmbed(await searchParams);
  if (state.status !== "ready") return <ChatUnavailable host={state.host} />;
  return (
    <ChatPanel
      publicKey={state.key}
      host={state.host}
      headerText={state.config.headerText}
      showBadge={state.config.showBadge}
    />
  );
}
