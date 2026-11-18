import { PanelShell } from "@/components/embed/panel-shell";

/**
 * The chat panel while /embed loads inside the customer's site: the panel's shape with
 * placeholders, so the iframe isn't blank. Server-only markup, no client JS. The header
 * text comes from the project's config, which isn't known yet, so it's a placeholder too.
 */
export default function EmbedLoading() {
  return (
    <PanelShell>
      <div role="status" aria-live="polite" className="flex min-h-0 flex-1 flex-col">
        <span className="sr-only">Loading chat…</span>
        <div className="flex h-14 shrink-0 items-center border-b border-border bg-glass-strong px-4 backdrop-blur-glass">
          <Bar className="h-4 w-32" />
        </div>
        <div className="grid flex-1 place-items-center px-6">
          <div className="flex w-full flex-col items-center gap-2">
            <Bar className="h-4 w-28" />
            <Bar className="h-3.5 w-56 max-w-full" />
          </div>
        </div>
        <div className="shrink-0 border-t border-border bg-glass-strong px-3 pt-3 pb-2 backdrop-blur-glass">
          <Bar className="h-11 w-full rounded-lg" />
          <div className="h-6" />
        </div>
      </div>
    </PanelShell>
  );
}

function Bar({ className }: { className: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-fg/10 ${className}`} />;
}
