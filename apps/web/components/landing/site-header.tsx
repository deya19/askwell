import { APP_NAME } from "@askwell/shared";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#demo", label: "Demo" },
  { href: "#pricing", label: "Pricing" },
  { href: "#install", label: "Install" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/70 backdrop-blur-glass-strong">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <LogoMark />
          {APP_NAME}
        </Link>
        <ul className="hidden items-center gap-6 text-sm text-muted md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="transition-colors hover:text-fg">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <ButtonLink href="/sign-up" size="sm">
          Start free
        </ButtonLink>
      </nav>
    </header>
  );
}

export function LogoMark() {
  return (
    <span aria-hidden className="grid size-7 place-items-center rounded-md bg-accent text-accent-fg">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M5 18V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H9l-4 3" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
