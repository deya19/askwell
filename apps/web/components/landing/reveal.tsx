"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef, type CSSProperties } from "react";

type RevealProps = ComponentPropsWithoutRef<"div"> & {
  /** Delay before this element fades in, in ms. */
  delay?: number;
};

/**
 * Fades its content up when it scrolls into view. The hidden state lives in
 * globals.css under `prefers-reduced-motion: no-preference`, so with reduced
 * motion the content is simply shown.
 */
export function Reveal({ delay = 0, style, ...props }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.reveal = "visible";
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.dataset.reveal = "visible";
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal="hidden"
      style={{ ...style, "--reveal-delay": `${delay}ms` } as CSSProperties}
      {...props}
    />
  );
}
