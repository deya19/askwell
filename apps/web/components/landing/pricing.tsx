import { APP_NAME } from "@askwell/shared";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { cn } from "@/components/ui/cn";
import { PLAN_LIMITS } from "@askwell/shared";
import { pricingRows } from "./pricing-rows";
import { Reveal } from "./reveal";
import { Section } from "./section";

const plans = [
  {
    key: "free",
    name: "Free",
    tagline: "Try it on one site.",
    cta: "Start free",
    featured: false,
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "More projects, more messages, your look.",
    cta: "Start free, upgrade anytime",
    featured: true,
  },
] as const;

export function Pricing() {
  const rows = pricingRows(PLAN_LIMITS);

  return (
    <Section
      id="pricing"
      eyebrow="Pricing"
      title="Start free. Upgrade when you grow."
      intro={`Every plan runs the same ${APP_NAME} answers. Pro adds room and your own look.`}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan, i) => (
          <Reveal key={plan.key} delay={i * 120} className="h-full">
            <GlassPanel
              strong={plan.featured}
              className={cn("flex h-full flex-col rounded-xl p-6 sm:p-8", plan.featured && "border-white/25")}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                {plan.featured ? (
                  <span className="rounded-pill bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-fg">
                    Most room
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-muted">{plan.tagline}</p>

              <dl className="mt-6 flex-1 divide-y divide-border text-sm">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="text-muted">{row.label}</dt>
                    <dd className="text-right font-medium">{row[plan.key]}</dd>
                  </div>
                ))}
              </dl>

              <ButtonLink
                href="/sign-up"
                variant={plan.featured ? "primary" : "secondary"}
                className="mt-8 w-full"
              >
                {plan.cta}
              </ButtonLink>
            </GlassPanel>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
