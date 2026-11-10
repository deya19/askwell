import { GlassPanel } from "@/components/ui/glass-panel";
import { Reveal } from "./reveal";
import { Section } from "./section";

const steps = [
  {
    title: "Add your knowledge",
    body: "Upload a PDF or paste text about your product. That is what the bot answers from.",
  },
  {
    title: "Paste one script tag",
    body: "Copy the snippet from the Install page and drop it into any site. The chat button appears.",
  },
  {
    title: "Visitors get answers",
    body: "Questions are answered from your info. Read every conversation in your dashboard.",
  },
];

export function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      eyebrow="How it works"
      title="Live on your site in three steps"
      intro="No code to write and nothing to host."
    >
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title}>
            <Reveal delay={i * 120} className="h-full">
              <GlassPanel className="h-full p-6 transition duration-300 hover:-translate-y-1 hover:bg-glass-strong">
                <span className="grid size-9 place-items-center rounded-pill border border-border text-sm font-semibold">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </GlassPanel>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
