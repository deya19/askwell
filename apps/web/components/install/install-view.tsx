import Link from "next/link";
import { CopyButton } from "@/components/landing/copy-button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { INSTALL_STEPS } from "./snippet";

/** The snippet in a code panel with a copy button, then the three steps. */
export function InstallView({ snippet }: { snippet: string }) {
  return (
    <>
      <GlassPanel strong className="mt-8 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <span className="text-xs text-muted">Paste before &lt;/body&gt;</span>
          <CopyButton text={snippet} />
        </div>
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed sm:p-5">
          <code className="font-mono break-all whitespace-pre-wrap">{snippet}</code>
        </pre>
      </GlassPanel>

      <ol className="mt-8 grid gap-3 sm:grid-cols-3">
        {INSTALL_STEPS.map((step, i) => (
          <li key={step}>
            <GlassPanel className="flex h-full gap-3 p-4 text-sm text-muted">
              <span
                aria-hidden
                className="grid size-6 shrink-0 place-items-center rounded-pill bg-accent text-xs font-semibold text-accent-fg"
              >
                {i + 1}
              </span>
              <span className="text-pretty">{step}</span>
            </GlassPanel>
          </li>
        ))}
      </ol>
    </>
  );
}

/** "← Projects", back to the list. */
export function BackToProjects() {
  return (
    <Link
      href="/dashboard/projects"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Projects
    </Link>
  );
}
