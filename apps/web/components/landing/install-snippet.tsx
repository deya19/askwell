import { GlassPanel } from "@/components/ui/glass-panel";
import { CopyButton } from "./copy-button";
import { Reveal } from "./reveal";
import { Section } from "./section";

/** Where the widget script is served from, for this deployment. */
function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const steps = ["Sign up and create a project.", "Open Install and copy your snippet.", "Paste it before </body> on your site."];

export function InstallSnippet() {
  const snippet = `<script src="${appUrl()}/widget.js" data-key="pk_your_project_key"></script>`;

  return (
    <Section
      id="install"
      eyebrow="Install"
      title="One line of code"
      intro="Works on any website: plain HTML, WordPress, Shopify, Webflow, or your own app."
    >
      <Reveal className="mx-auto max-w-3xl">
        <GlassPanel strong className="overflow-hidden rounded-xl">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <span className="flex gap-1.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-ink-700" />
              <span className="size-2.5 rounded-full bg-ink-700" />
              <span className="size-2.5 rounded-full bg-ink-700" />
            </span>
            <span className="text-xs text-muted">index.html</span>
            <CopyButton text={snippet} />
          </div>
          <pre className="overflow-x-auto p-5 text-sm leading-relaxed">
            <code className="font-mono">{snippet}</code>
          </pre>
        </GlassPanel>
        <ol className="mt-8 grid gap-3 text-sm text-muted sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="font-semibold text-fg">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ol>
      </Reveal>
    </Section>
  );
}
