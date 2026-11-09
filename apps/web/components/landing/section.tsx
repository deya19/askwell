import type { ReactNode } from "react";
import { Reveal } from "./reveal";

type SectionProps = {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
};

/** A landing page section with a centered heading. */
export function Section({ id, eyebrow, title, intro, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">{eyebrow}</p>
          <h2 id={`${id}-title`} className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {title}
          </h2>
          {intro ? <p className="mt-4 text-base text-pretty text-muted sm:text-lg">{intro}</p> : null}
        </Reveal>
        <div className="mt-12 sm:mt-16">{children}</div>
      </div>
    </section>
  );
}
