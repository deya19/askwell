import type { MessageRole } from "@askwell/shared";
import Link from "next/link";
import { GlassPanel } from "@/components/ui/glass-panel";
import { cn } from "@/components/ui/cn";
import { ROLE_LABELS } from "./copy";

export type ThreadMessage = {
  id: string;
  role: MessageRole;
  body: string;
  createdAt: string;
  /** Pre-formatted on the server. */
  time: string;
};

/**
 * The whole thread, oldest first. Visitor messages on the left, bot replies on the right
 * and filled, each with its label. Bodies render as React text, never HTML, inside
 * `ph-no-capture` so session replay never records them (project.md §9).
 */
export function ThreadView({ messages }: { messages: ThreadMessage[] }) {
  if (messages.length === 0) {
    return (
      <GlassPanel className="mt-8 px-6 py-14 text-center text-sm text-muted">
        This conversation has no messages.
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="mt-8 p-4 sm:p-5">
      <ol aria-label="Messages" className="ph-no-capture flex flex-col gap-4">
        {messages.map((message) => {
          const bot = message.role === "bot";
          return (
            <li key={message.id} className={cn("flex flex-col gap-1", bot ? "items-end" : "items-start")}>
              <span className="px-1 text-xs text-muted">
                <span className="font-medium text-fg">{ROLE_LABELS[message.role]}</span>
                <span aria-hidden className="mx-1.5">
                  ·
                </span>
                <time dateTime={message.createdAt}>{message.time}</time>
              </span>
              <p
                className={cn(
                  "max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap sm:max-w-[75%]",
                  bot ? "bg-accent text-accent-fg" : "border border-border bg-bg-raised text-fg",
                )}
              >
                {message.body}
              </p>
            </li>
          );
        })}
      </ol>
    </GlassPanel>
  );
}

/** "← Conversations", back to the project's list. */
export function BackToConversations({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Conversations
    </Link>
  );
}
