import { APP_NAME } from "@askwell/shared";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

const delay = (ms: number) => ({ animationDelay: `${ms}ms` }) as CSSProperties;

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden px-4 pt-20 pb-24 sm:px-6 sm:pt-28 sm:pb-32">
      <HeroBackdrop />
      <div className="relative mx-auto max-w-3xl text-center">
        <div className="animate-enter" style={delay(0)}>
          <Badge>
            <span className="size-1.5 rounded-full bg-fg" aria-hidden />
            AI support chat for any website
          </Badge>
        </div>
        <h1
          id="hero-title"
          className="mt-6 animate-enter text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
          style={delay(100)}
        >
          Answers for your visitors, from your own docs.
        </h1>
        <p className="mx-auto mt-6 max-w-xl animate-enter text-lg text-pretty text-muted" style={delay(200)}>
          Add your product info, paste one script tag, and {APP_NAME} answers visitor questions on your site, day and
          night.
        </p>
        <div className="mt-10 flex animate-enter flex-col items-center justify-center gap-3 sm:flex-row" style={delay(300)}>
          <ButtonLink href="/sign-up" size="lg" className="w-full sm:w-auto">
            Start free
          </ButtonLink>
          <ButtonLink href="#how-it-works" variant="secondary" size="lg" className="w-full sm:w-auto">
            See how it works
          </ButtonLink>
        </div>
        <p className="mt-4 animate-enter text-sm text-muted" style={delay(400)}>
          No card needed for the Free plan.
        </p>
      </div>
    </section>
  );
}

function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at 50% 30%, black 20%, transparent 70%)",
        }}
      />
      <div className="absolute top-[-20%] left-1/2 h-[480px] w-[min(720px,140%)] -translate-x-1/2 rounded-full bg-white/[0.07] blur-3xl" />
    </div>
  );
}
