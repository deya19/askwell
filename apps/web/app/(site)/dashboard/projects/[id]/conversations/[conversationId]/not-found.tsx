import Link from "next/link";
import { AlertIcon, StatePanel } from "@/components/dashboard/states";
import { buttonClasses } from "@/components/ui/button";

/** A conversation (or project) that doesn't exist or isn't the caller's. Same page for both (project.md §9). */
export default function ConversationNotFound() {
  return (
    <StatePanel
      icon={<AlertIcon />}
      title="Conversation not found"
      action={
        <Link href="/dashboard/projects" className={buttonClasses({ variant: "secondary" })}>
          Back to projects
        </Link>
      }
    >
      This conversation doesn&apos;t exist, or you don&apos;t have access to it.
    </StatePanel>
  );
}
