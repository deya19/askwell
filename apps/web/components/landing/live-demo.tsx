import { APP_NAME } from "@askwell/shared";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Reveal } from "./reveal";
import { Section } from "./section";

type DemoMessage = { from: "visitor" | "bot"; text: string };

// Static sample conversation. Shown as a picture of the panel; when the landing widget
// key is set, the real widget also runs in the corner (see landing-widget.ts).
const messages: DemoMessage[] = [
  { from: "visitor", text: "Can I add the chat to my Shopify store?" },
  {
    from: "bot",
    text: "Yes. Copy your script tag from the Install page and paste it into your theme. The chat button shows up right away.",
  },
  { from: "visitor", text: "What does it answer from?" },
  { from: "bot", text: "Only from the product info you add: PDFs or pasted text." },
];

export function LiveDemo({ live }: { live: boolean }) {
  return (
    <Section
      id="demo"
      eyebrow="Live demo"
      title="See what your visitors see"
      intro={
        live
          ? `Try it: the chat button in the corner is the real widget. Ask it anything about ${APP_NAME}.`
          : "A preview of the chat panel your visitors open."
      }
    >
      <Reveal className="relative mx-auto max-w-md">
        <div aria-hidden className="absolute inset-x-8 -inset-y-6 rounded-xl bg-white/[0.06] blur-3xl" />
        <GlassPanel
          strong
          role="img"
          aria-label="Preview of the chat widget with a sample conversation"
          className="relative overflow-hidden rounded-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="text-sm font-semibold">How can we help?</p>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <span className="size-1.5 rounded-full bg-fg" />
                Typically replies instantly
              </p>
            </div>
            <span className="grid size-7 place-items-center rounded-pill border border-border text-muted">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </span>
          </div>

          <ul className="flex flex-col gap-3 px-5 py-5">
            {messages.map((m, i) => (
              <li
                key={i}
                className={
                  m.from === "visitor"
                    ? "max-w-[85%] self-end rounded-lg rounded-br-sm bg-accent px-4 py-2.5 text-sm text-accent-fg"
                    : "max-w-[85%] self-start rounded-lg rounded-bl-sm border border-border bg-glass px-4 py-2.5 text-sm"
                }
              >
                {m.text}
              </li>
            ))}
            <li className="flex items-center gap-1 self-start rounded-lg border border-border bg-glass px-4 py-3">
              <span className="sr-only">Typing</span>
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="size-1.5 animate-pulse rounded-full bg-muted"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </li>
          </ul>

          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center gap-2 rounded-pill border border-border bg-glass px-4 py-2 text-sm text-muted">
              <span className="flex-1">Ask a question…</span>
              <span className="grid size-7 place-items-center rounded-pill bg-accent text-accent-fg">
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted">Powered by {APP_NAME}</p>
          </div>
        </GlassPanel>

        <div className="mt-6 flex justify-end">
          {live ? (
            <p className="inline-flex items-center gap-2 text-sm text-muted">
              Above is a sample. The real one is in the corner
              <svg aria-hidden viewBox="0 0 24 24" className="size-4 animate-float" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 7l10 10M17 9v8H9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </p>
          ) : (
            <span
              aria-hidden
              className="inline-flex animate-float items-center gap-2 rounded-pill bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg shadow-lift"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 18V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H9l-4 3" strokeLinejoin="round" />
              </svg>
              Ask a question
            </span>
          )}
        </div>
      </Reveal>
    </Section>
  );
}
