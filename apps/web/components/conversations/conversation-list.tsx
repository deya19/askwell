import Link from "next/link";
import { StatePanel } from "@/components/dashboard/states";
import { installPath } from "@/components/projects/copy";
import { buttonClasses } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { EMPTY_PREVIEW, listLimitNote, type ConversationRowData } from "./copy";

/**
 * The project's conversations, newest first. Previews are visitor text: rendered as React
 * text (never HTML), inside `ph-no-capture` so session replay never records them.
 */
export function ConversationList({ projectId, rows }: { projectId: string; rows: ConversationRowData[] }) {
  if (rows.length === 0) {
    return (
      <StatePanel
        icon={<ChatIcon />}
        title="No conversations yet"
        action={
          <Link href={installPath(projectId)} className={buttonClasses({ variant: "secondary" })}>
            Install the widget
          </Link>
        }
      >
        Chats from your site show up here. Add the widget to your site, then press Refresh.
      </StatePanel>
    );
  }

  const note = listLimitNote(rows.length);

  return (
    <>
      <GlassPanel className="mt-8 overflow-hidden">
        <ul aria-label="Conversations" className="ph-no-capture divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="flex flex-col gap-1 px-4 py-4 transition-colors hover:bg-glass-strong focus-visible:bg-glass-strong sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
              >
                <span className="min-w-0">
                  {row.preview ? (
                    <span className="block truncate font-medium" title={row.preview}>
                      {row.preview}
                    </span>
                  ) : (
                    <span className="block font-medium text-muted italic">{EMPTY_PREVIEW}</span>
                  )}
                </span>
                <span className="shrink-0 text-sm text-muted">
                  {row.count}
                  <span aria-hidden className="mx-2">
                    ·
                  </span>
                  <time dateTime={row.createdAt} title={row.fullTime}>
                    {row.time}
                  </time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </GlassPanel>
      {note && <p className="mt-3 text-center text-sm text-muted">{note}</p>}
    </>
  );
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17H10l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  );
}
